const { randomInt } = require("crypto");
const {
  app,
  auth,
  internal,
  errors,
  asyncRoute: r,
  pool,
  transaction,
  http,
  assert,
  randomUUID,
} = require("../../shared/core");
const { rpc } = require("../../shared/booking-client");
const { lateFee } = require("../../shared/rules");
const events = require("../../shared/events");
async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS rentals(id text PRIMARY KEY,listing_id text NOT NULL,owner_id text NOT NULL,renter_id text NOT NULL,due_at timestamptz NOT NULL,start_at timestamptz NOT NULL,terms jsonb NOT NULL,state text NOT NULL DEFAULT 'AWAITING_PICKUP',pickup_code text NOT NULL,return_code text NOT NULL,picked_up_at timestamptz,returned_at timestamptz,late_fee int DEFAULT 0,error text,reminded boolean DEFAULT false);
 CREATE TABLE IF NOT EXISTS evidence(id uuid PRIMARY KEY,rental_id text NOT NULL,author_id text NOT NULL,phase text NOT NULL,condition text NOT NULL,accessories text NOT NULL,photos jsonb NOT NULL,created_at timestamptz DEFAULT now(),UNIQUE(rental_id,author_id,phase));`);
  await events.schema(pool);
  const a = app("rental");
  const find = async (id) =>
    (await pool.query("SELECT * FROM rentals WHERE id=$1", [id])).rows[0];
  const participant = (v, u) =>
    assert(
      (v && [v.owner_id, v.renter_id].includes(u.sub)) ||
        (v && u.role === "admin"),
      403,
      "Rental participants only",
    );
  function safe(v, u) {
    const result = { ...v };
    if (u.sub !== v.owner_id) delete result.pickup_code;
    if (u.sub !== v.renter_id) delete result.return_code;
    return result;
  }
  a.post(
    "/internal/rentals",
    internal,
    r(async (req, res) => {
      const b = req.body;
      const code = () => String(randomInt(100000, 1000000));
      await pool.query(
        `INSERT INTO rentals(id,listing_id,owner_id,renter_id,due_at,start_at,terms,pickup_code,return_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [
          b.id,
          b.listing_id,
          b.owner_id,
          b.renter_id,
          b.end_at,
          b.start_at,
          b.terms,
          code(),
          code(),
        ],
      );
      res.json({ id: b.id });
    }),
  );
  a.post(
    "/internal/rentals/:id/cancel",
    internal,
    r(async (req, res) => {
      await transaction(async (c) => {
        const v = (
          await c.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        if (!v) return;
        assert(
          ["AWAITING_PICKUP", "CANCELLED"].includes(v.state),
          409,
          "Cannot cancel a rental after pickup",
        );
        await c.query(`UPDATE rentals SET state='CANCELLED' WHERE id=$1`, [
          v.id,
        ]);
      });
      res.json({ cancelled: true });
    }),
  );
  a.get(
    "/internal/blocked",
    internal,
    r(async (req, res) =>
      res.json(
        (
          await pool.query(
            `SELECT DISTINCT listing_id FROM rentals WHERE state IN ('ACTIVE','OVERDUE')`,
          )
        ).rows.map((v) => v.listing_id),
      ),
    ),
  );
  a.get(
    "/internal/rentals/:id",
    internal,
    r(async (req, res) => {
      const v = await find(req.params.id);
      assert(v, 404, "Rental not found");
      const { pickup_code, return_code, ...data } = v;
      res.json(data);
    }),
  );
  a.get(
    "/rentals",
    auth,
    r(async (req, res) => {
      const { rows } = await pool.query(
        "SELECT * FROM rentals WHERE owner_id=$1 OR renter_id=$1 OR $2 ORDER BY start_at DESC",
        [req.user.sub, req.user.role === "admin"],
      );
      res.json(rows.map((v) => safe(v, req.user)));
    }),
  );
  a.get(
    "/rentals/:id",
    auth,
    r(async (req, res) => {
      const v = await find(req.params.id);
      assert(v, 404, "Rental not found");
      participant(v, req.user);
      res.json({
        ...safe(v, req.user),
        evidence: (
          await pool.query(
            "SELECT * FROM evidence WHERE rental_id=$1 ORDER BY created_at",
            [v.id],
          )
        ).rows,
      });
    }),
  );
  a.post(
    "/rentals/:id/evidence",
    auth,
    r(async (req, res) => {
      await transaction(async (c) => {
        const v = (
          await c.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        assert(v, 404, "Rental not found");
        assert(
          [v.owner_id, v.renter_id].includes(req.user.sub),
          403,
          "Owner/renter evidence only",
        );
        const b = req.body;
        assert(
          ["pickup", "return"].includes(b.phase),
          400,
          "Invalid evidence phase",
        );
        assert(
          b.phase === "pickup"
            ? v.state === "AWAITING_PICKUP"
            : ["ACTIVE", "OVERDUE"].includes(v.state),
          409,
          "Evidence phase is locked",
        );
        assert(
          typeof b.condition === "string" &&
            b.condition.trim() &&
            b.condition.length <= 1000 &&
            typeof b.accessories === "string" &&
            b.accessories.trim() &&
            b.accessories.length <= 1000,
          400,
          "Record condition and accessories",
        );
        assert(
          Array.isArray(b.photos) &&
            b.photos.length >= 1 &&
            b.photos.length <= 3 &&
            b.photos.every(
              (x) =>
                typeof x === "string" &&
                /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
                  x,
                ) &&
                x.length < 250000,
            ),
          400,
          "Attach 1–3 compressed condition photos",
        );
        await c.query(
          `INSERT INTO evidence(id,rental_id,author_id,phase,condition,accessories,photos) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(rental_id,author_id,phase) DO UPDATE SET condition=EXCLUDED.condition,accessories=EXCLUDED.accessories,photos=EXCLUDED.photos`,
          [
            randomUUID(),
            v.id,
            req.user.sub,
            b.phase,
            b.condition.trim(),
            b.accessories.trim(),
            JSON.stringify(b.photos),
          ],
        );
      });
      res.status(201).json({ recorded: true });
    }),
  );
  a.post(
    "/rentals/:id/pickup",
    auth,
    r(async (req, res) => {
      const result = await transaction(async (c) => {
        const v = (
          await c.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        assert(v, 404, "Rental not found");
        assert(v.renter_id === req.user.sub, 403, "Renter confirms pickup");
        if (["ACTIVE", "OVERDUE"].includes(v.state)) return v;
        assert(
          v.state === "AWAITING_PICKUP",
          409,
          "Rental cannot be picked up",
        );
        assert(
          req.body.code === v.pickup_code,
          400,
          "Invalid one-time pickup code",
        );
        assert(
          process.env.DEMO_MODE === "true" ||
            new Date(v.start_at) <= new Date(),
          409,
          "Pickup time has not arrived",
        );
        assert(
          (
            await c.query(
              `SELECT count(*)::int n FROM evidence WHERE rental_id=$1 AND phase='pickup'`,
              [v.id],
            )
          ).rows[0].n === 2,
          409,
          "Both parties must record pickup evidence",
        );
        const b = await rpc(
          "getBooking",
          { id: v.id },
          undefined,
          req.correlation,
          true,
        );
        assert(
          b.status === "CONFIRMED",
          409,
          "Booking confirmation is incomplete",
        );
        await http(
          `${process.env.PAYMENT_URL}/internal/payments/${v.id}/capture`,
          {
            service: true,
            method: "POST",
            body: {},
            correlation: req.correlation,
          },
        );
        const row = (
          await c.query(
            `UPDATE rentals SET state='ACTIVE',picked_up_at=now(),error=NULL,pickup_code='' WHERE id=$1 RETURNING *`,
            [v.id],
          )
        ).rows[0];
        await events.event(
          c,
          "rental.picked_up",
          [v.owner_id, v.renter_id],
          { rentalId: v.id },
          req.correlation,
        );
        return row;
      });
      res.json(safe(result, req.user));
    }),
  );
  async function settle(id, correlation) {
    // Accepted return is committed before payment: retries cannot lose custody.
    return transaction(async (c) => {
      const v = (
        await c.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (v.state === "CLOSED") return v;
      assert(
        v.state === "SETTLEMENT_PENDING",
        409,
        "Return must be accepted first",
      );
      try {
        await rpc(
          "releaseCalendar",
          { id, completed: false },
          undefined,
          correlation,
          true,
        );
        await http(
          `${process.env.PAYMENT_URL}/internal/payments/${id}/settle`,
          {
            service: true,
            method: "POST",
            body: { lateFee: v.late_fee },
            correlation,
          },
        );
        await rpc("releaseCalendar", { id }, undefined, correlation, true);
        const row = (
          await c.query(
            `UPDATE rentals SET state='CLOSED',error=NULL WHERE id=$1 RETURNING *`,
            [id],
          )
        ).rows[0];
        await events.event(
          c,
          "rental.closed",
          [v.owner_id, v.renter_id],
          { rentalId: id, lateFee: v.late_fee },
          correlation,
        );
        return row;
      } catch (e) {
        return (
          await c.query("UPDATE rentals SET error=$2 WHERE id=$1 RETURNING *", [
            id,
            e.message,
          ])
        ).rows[0];
      }
    });
  }
  a.post(
    "/rentals/:id/return",
    auth,
    r(async (req, res) => {
      await transaction(async (c) => {
        const v = (
          await c.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [
            req.params.id,
          ])
        ).rows[0];
        assert(v, 404, "Rental not found");
        assert(v.owner_id === req.user.sub, 403, "Owner accepts the return");
        if (["SETTLEMENT_PENDING", "CLOSED"].includes(v.state)) return;
        assert(
          ["ACTIVE", "OVERDUE"].includes(v.state),
          409,
          "Rental is not in custody",
        );
        assert(
          req.body.accepted === true,
          400,
          "Explicit accepted return is required",
        );
        assert(
          req.body.code === v.return_code,
          400,
          "Invalid one-time return code",
        );
        assert(
          (
            await c.query(
              `SELECT count(*)::int n FROM evidence WHERE rental_id=$1 AND phase='return'`,
              [v.id],
            )
          ).rows[0].n === 2,
          409,
          "Both parties must record return evidence",
        );
        const returned = new Date();
        await c.query(
          `UPDATE rentals SET state='SETTLEMENT_PENDING',returned_at=$2,late_fee=$3,return_code='' WHERE id=$1`,
          [
            v.id,
            returned,
            lateFee(v.due_at, returned, v.terms.dailyRate, v.terms.deposit),
          ],
        );
        await events.event(
          c,
          "rental.return_accepted",
          [v.owner_id, v.renter_id],
          { rentalId: v.id },
          req.correlation,
        );
      });
      res.json(safe(await settle(req.params.id, req.correlation), req.user));
    }),
  );
  a.post(
    "/rentals/:id/settle",
    auth,
    r(async (req, res) => {
      const v = await find(req.params.id);
      assert(v, 404, "Rental not found");
      participant(v, req.user);
      res.json(safe(await settle(v.id, req.correlation), req.user));
    }),
  );
  let ticking = false;
  setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await transaction(async (c) => {
        const { rows } = await c.query(
          `UPDATE rentals SET state='OVERDUE' WHERE state='ACTIVE' AND due_at<now() RETURNING *`,
        );
        for (const v of rows) {
          await events.event(
            c,
            "rental.overdue",
            [v.owner_id, v.renter_id, "admin"],
            { rentalId: v.id },
          );
          const affected = await rpc(
            "affectedBookings",
            { listingId: v.listing_id, id: v.id, due: v.due_at },
            undefined,
            undefined,
            true,
          );
          for (const b of affected)
            await events.event(
              c,
              "booking.return_delay",
              [b.owner_id, b.renter_id],
              {
                bookingId: b.id,
                message:
                  "Earlier item not returned. Agree a reschedule by cancelling/rebooking or cancel for full reversal.",
              },
            );
        }
        const reminders = await c.query(
          `UPDATE rentals SET reminded=true WHERE state='ACTIVE' AND due_at<now()+interval '24 hours' AND reminded=false RETURNING *`,
        );
        for (const v of reminders.rows)
          await events.event(c, "rental.return_reminder", [v.renter_id], {
            rentalId: v.id,
            due: v.due_at,
          });
      });
    } catch (e) {
      console.error(e.message);
    } finally {
      ticking = false;
    }
  }, 10000).unref();
  errors(a);
  events.publisher(pool);
  a.listen(3003, () => console.log("Rental REST :3003"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
