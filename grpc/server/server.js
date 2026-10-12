const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const path = require("path");
const {
  pool,
  transaction,
  http,
  tokenUser,
  assert,
  fail,
  randomUUID,
} = require("../../shared/core");
const { period } = require("../../shared/rules");
const events = require("../../shared/events");
async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS bookings(id text PRIMARY KEY,listing_id text NOT NULL,owner_id text NOT NULL,renter_id text NOT NULL,start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'PENDING',terms jsonb NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz DEFAULT now(),error text);
 CREATE TABLE IF NOT EXISTS calendar(id text PRIMARY KEY,listing_id text NOT NULL,booking_id text,period tstzrange NOT NULL,EXCLUDE USING gist(listing_id WITH =,period WITH &&));`);
  await events.schema(pool);
  const proto = grpc.loadPackageDefinition(
    loader.loadSync(path.join(__dirname, "../booking.proto")),
  ).campuskit;
  const server = new grpc.Server();
  async function user(ctx) {
    const u = await http(
      `${process.env.IDENTITY_URL}/internal/users/${ctx.user.sub}`,
      { service: true },
    );
    assert(u && !u.suspended, 403, "Account restricted");
    return u;
  }
  const participant = (b, ctx) =>
    assert(
      b &&
        (b.owner_id === ctx.user.sub ||
          b.renter_id === ctx.user.sub ||
          ctx.user.role === "admin"),
      403,
      "Rental participants only",
    );
  const get = async (id) =>
    (await pool.query("SELECT * FROM bookings WHERE id=$1", [id])).rows[0];
  const handlers = {
    listBookings: async (b, ctx) => {
      await user(ctx);
      return (
        await pool.query(
          "SELECT * FROM bookings WHERE owner_id=$1 OR renter_id=$1 OR $2 ORDER BY created_at DESC",
          [ctx.user.sub, ctx.user.role === "admin"],
        )
      ).rows;
    },
    getBooking: async (b, ctx) => {
      const row = await get(b.id);
      assert(row, 404, "Booking not found");
      if (!ctx.service) {
        await user(ctx);
        participant(row, ctx);
      }
      return row;
    },
    requestBooking: async (b, ctx) => {
      const u = await user(ctx);
      assert(u.verified, 403, "Current student verification is required");
      const l = await http(
        `${process.env.LISTING_URL}/internal/listings/${encodeURIComponent(b.listingId)}`,
        { service: true },
      );
      assert(l.status === "PUBLISHED", 409, "Listing is not published");
      assert(l.owner_id !== u.id, 403, "You cannot rent your own listing");
      const p = period(b.start, b.end);
      assert(
        new Date(p.start) > new Date(),
        400,
        "Pickup must be in the future",
      );
      assert(
        p.days >= l.min_days && p.days <= l.max_days,
        400,
        "Rental duration is outside listing limits",
      );
      const blocked = await http(`${process.env.RENTAL_URL}/internal/blocked`, {
        service: true,
      });
      assert(
        !blocked.includes(l.id),
        409,
        "Item remains in custody; accepted return required",
      );
      const id = randomUUID();
      const terms = {
        title: l.title,
        dailyRate: l.daily_rate,
        deposit: l.deposit,
        fee: p.days * l.daily_rate,
        days: p.days,
        pickupZone: l.pickup_zone,
        condition: l.condition,
        accessories: l.accessories,
        lateFeeRule: "Per started overdue day, capped at deposit",
        cancellation: "Full reversal before pickup",
      };
      return transaction(async (c) => {
        await c.query(
          "INSERT INTO bookings(id,listing_id,owner_id,renter_id,start_at,end_at,terms,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,LEAST(now()+interval '24 hours',$5::timestamptz))",
          [id, l.id, l.owner_id, u.id, p.start, p.end, terms],
        );
        await c.query(
          `INSERT INTO calendar(id,listing_id,booking_id,period) VALUES($1,$2,$1,tstzrange($3,$4,'[)'))`,
          [id, l.id, p.start, p.end],
        );
        await events.event(
          c,
          "booking.requested",
          [u.id, l.owner_id],
          { bookingId: id, title: l.title },
          ctx.correlation,
        );
        return (await c.query("SELECT * FROM bookings WHERE id=$1", [id]))
          .rows[0];
      });
    },
    approveBooking: async (b, ctx) => {
      await user(ctx);
      return transaction(async (c) => {
        const row = (
          await c.query("SELECT * FROM bookings WHERE id=$1 FOR UPDATE", [b.id])
        ).rows[0];
        assert(row, 404, "Booking not found");
        const renter = await http(
          `${process.env.IDENTITY_URL}/internal/users/${row.renter_id}`,
          { service: true },
        );
        assert(
          renter.verified && !renter.suspended,
          403,
          "Renter no longer eligible",
        );
        assert(
          row.owner_id === ctx.user.sub,
          403,
          "Only the owner can approve",
        );
        if (row.status === "CONFIRMED") return row;
        assert(
          ["PENDING", "AUTHORIZING", "PAYMENT_FAILED"].includes(row.status),
          409,
          "Cannot approve this booking",
        );
        assert(
          new Date(row.expires_at) > new Date(),
          409,
          "Request or payment retry window expired",
        );
        // Mark durable intent outside the final transaction would weaken locking. A
        // locked row and stable payment operation IDs make recovery safe after crash.
        try {
          await http(
            `${process.env.PAYMENT_URL}/internal/payments/${row.id}/authorize`,
            {
              service: true,
              method: "POST",
              body: {
                renterId: row.renter_id,
                ownerId: row.owner_id,
                fee: row.terms.fee,
                deposit: row.terms.deposit,
              },
              correlation: ctx.correlation,
            },
          );
          await http(`${process.env.RENTAL_URL}/internal/rentals`, {
            service: true,
            method: "POST",
            body: row,
            correlation: ctx.correlation,
          });
          const result = (
            await c.query(
              `UPDATE bookings SET status='CONFIRMED',error=NULL WHERE id=$1 RETURNING *`,
              [row.id],
            )
          ).rows[0];
          await events.event(
            c,
            "booking.confirmed",
            [row.owner_id, row.renter_id],
            { bookingId: row.id, title: row.terms.title },
            ctx.correlation,
          );
          return result;
        } catch (e) {
          await c.query(
            `UPDATE bookings SET status='PAYMENT_FAILED',error=$2,expires_at=LEAST(expires_at,now()+interval '30 minutes') WHERE id=$1`,
            [row.id, e.message],
          );
          return {
            ...(await c.query("SELECT * FROM bookings WHERE id=$1", [row.id]))
              .rows[0],
            retryRequired: true,
          };
        }
      });
    },
    cancelBooking: async (b, ctx) => {
      await user(ctx);
      return transaction(async (c) => {
        const row = (
          await c.query("SELECT * FROM bookings WHERE id=$1 FOR UPDATE", [b.id])
        ).rows[0];
        assert(row, 404, "Booking not found");
        participant(row, ctx);
        if (row.status === "CANCELLED") return row;
        assert(
          ["PENDING", "CONFIRMED", "PAYMENT_FAILED"].includes(row.status),
          409,
          "Booking cannot be cancelled",
        );
        await http(
          `${process.env.RENTAL_URL}/internal/rentals/${row.id}/cancel`,
          {
            service: true,
            method: "POST",
            body: {},
            correlation: ctx.correlation,
          },
        );
        await http(
          `${process.env.PAYMENT_URL}/internal/payments/${row.id}/void`,
          {
            service: true,
            method: "POST",
            body: {},
            correlation: ctx.correlation,
          },
        );
        await c.query("DELETE FROM calendar WHERE booking_id=$1", [row.id]);
        const result = (
          await c.query(
            `UPDATE bookings SET status='CANCELLED',error=NULL WHERE id=$1 RETURNING *`,
            [row.id],
          )
        ).rows[0];
        await events.event(
          c,
          "booking.cancelled",
          [row.owner_id, row.renter_id],
          { bookingId: row.id },
          ctx.correlation,
        );
        return result;
      });
    },
    setBlackouts: async (b, ctx) => {
      await user(ctx);
      const l = await http(
        `${process.env.LISTING_URL}/internal/listings/${encodeURIComponent(b.listingId)}`,
        { service: true },
      );
      assert(l.owner_id === ctx.user.sub, 403, "Owner calendar only");
      assert(
        Array.isArray(b.periods) && b.periods.length <= 100,
        400,
        "Supply at most 100 blackout periods",
      );
      const periods = b.periods.map((x) => period(x.start, x.end));
      await transaction(async (c) => {
        await c.query(
          "DELETE FROM calendar WHERE listing_id=$1 AND booking_id IS NULL",
          [l.id],
        );
        for (const p of periods)
          await c.query(
            `INSERT INTO calendar(id,listing_id,period) VALUES($1,$2,tstzrange($3,$4,'[)'))`,
            [randomUUID(), l.id, p.start, p.end],
          );
      });
      return { listingId: l.id, periods };
    },
    availability: async (b, ctx) => {
      assert(ctx.service, 403, "Internal operation");
      const p = period(b.start, b.end);
      assert(Array.isArray(b.ids), 400, "Supply IDs");
      const blocked = await http(`${process.env.RENTAL_URL}/internal/blocked`, {
        service: true,
      });
      const { rows } = await pool.query(
        `SELECT DISTINCT listing_id FROM calendar WHERE listing_id=ANY($1::text[]) AND period && tstzrange($2,$3,'[)')`,
        [b.ids, p.start, p.end],
      );
      const unavailable = new Set([
        ...blocked,
        ...rows.map((x) => x.listing_id),
      ]);
      return b.ids.filter((id) => !unavailable.has(id));
    },
    affectedBookings: async (b, ctx) => {
      assert(ctx.service, 403, "Internal operation");
      return (
        await pool.query(
          "SELECT * FROM bookings WHERE listing_id=$1 AND id<>$2 AND start_at>=$3 AND status IN ('PENDING','CONFIRMED','PAYMENT_FAILED')",
          [b.listingId, b.id, b.due],
        )
      ).rows;
    },
    releaseCalendar: async (b, ctx) => {
      assert(ctx.service, 403, "Internal operation");
      const row = await get(b.id);
      assert(row, 404, "Booking not found");
      await transaction(async (c) => {
        await c.query("DELETE FROM calendar WHERE booking_id=$1", [b.id]);
        await c.query("UPDATE bookings SET status=$2 WHERE id=$1", [
          b.id,
          b.completed === false ? "RETURNED" : "COMPLETED",
        ]);
      });
      return { released: true };
    },
  };
  function wrap(method) {
    return async (call, callback) => {
      try {
        const raw = call.metadata.get("authorization")[0];
        const service =
          call.metadata.get("x-service-token")[0] ===
          process.env.INTERNAL_SECRET;
        const internalOps = [
          "getBooking",
          "availability",
          "releaseCalendar",
          "affectedBookings",
        ];
        assert(
          !service || internalOps.includes(method),
          403,
          "Use participant identity for this RPC",
        );
        const u = service
          ? null
          : tokenUser(String(raw || "").replace(/^Bearer /, ""));
        const ctx = {
          user: u,
          token: String(raw || "").replace(/^Bearer /, ""),
          service,
          correlation: String(
            call.metadata.get("x-correlation-id")[0] || randomUUID(),
          ),
        };
        const body = JSON.parse(call.request.json || "{}");
        const data = await handlers[method](body, ctx);
        console.log(
          JSON.stringify({
            service: "booking",
            rpc: method,
            correlation: ctx.correlation,
            status: "ok",
          }),
        );
        callback(null, { json: JSON.stringify(data) });
      } catch (e) {
        const status =
          e.status ||
          (e.code === "23P01" ? 409 : e instanceof SyntaxError ? 400 : 500);
        const map = { 400: 3, 401: 16, 403: 7, 404: 5, 409: 9, 503: 14 };
        if (status === 500) console.error(e);
        callback({
          code: map[status] || 13,
          details:
            e.code === "23P01"
              ? "Selected dates overlap a reservation or blackout"
              : status === 500
                ? "Booking operation failed"
                : e.message,
        });
      }
    };
  }
  server.addService(
    proto.BookingService.service,
    Object.fromEntries(Object.keys(handlers).map((k) => [k, wrap(k)])),
  );
  events.publisher(pool);
  // Release expired windows only after reversing any remote authorization.
  setInterval(async () => {
    try {
      await transaction(async (c) => {
        const { rows } = await c.query(
          `UPDATE bookings SET status='EXPIRED' WHERE status='PENDING' AND expires_at<now() RETURNING *`,
        );
        for (const b of rows) {
          await c.query("DELETE FROM calendar WHERE booking_id=$1", [b.id]);
          await events.event(c, "booking.expired", [b.owner_id, b.renter_id], {
            bookingId: b.id,
          });
        }
      });
      const expired = (
        await pool.query(
          "SELECT id FROM bookings WHERE status='PAYMENT_FAILED' AND expires_at<now() LIMIT 10",
        )
      ).rows;
      for (const v of expired) {
        try {
          await transaction(async (c) => {
            const b = (
              await c.query(
                "SELECT * FROM bookings WHERE id=$1 AND status='PAYMENT_FAILED' AND expires_at<now() FOR UPDATE SKIP LOCKED",
                [v.id],
              )
            ).rows[0];
            if (!b) return;
            await http(
              `${process.env.RENTAL_URL}/internal/rentals/${b.id}/cancel`,
              { service: true, method: "POST", body: {} },
            );
            await http(
              `${process.env.PAYMENT_URL}/internal/payments/${b.id}/void`,
              { service: true, method: "POST", body: {} },
            );
            await c.query("DELETE FROM calendar WHERE booking_id=$1", [b.id]);
            await c.query(
              "UPDATE bookings SET status='EXPIRED',error=NULL WHERE id=$1",
              [b.id],
            );
            await events.event(
              c,
              "booking.expired",
              [b.owner_id, b.renter_id],
              { bookingId: b.id },
            );
          });
        } catch (e) {
          await pool.query("UPDATE bookings SET error=$2 WHERE id=$1", [
            v.id,
            e.message,
          ]);
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }, 10000).unref();
  server.bindAsync(
    "0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    (e) => {
      if (e) throw e;
      console.log("Booking gRPC :50051");
    },
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
