const {
  app,
  auth,
  internal,
  errors,
  asyncRoute: r,
  pool,
  transaction,
  http,
  eligible,
  assert,
  text,
  cents,
  randomUUID,
} = require("../shared/core");
const { rpc } = require("../shared/booking-client");
const events = require("../shared/events");
async function main() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS listings(id text PRIMARY KEY,owner_id text NOT NULL,title text NOT NULL,category text NOT NULL,description text NOT NULL,condition text NOT NULL,accessories text NOT NULL,pickup_zone text NOT NULL,daily_rate int NOT NULL CHECK(daily_rate>0),deposit int NOT NULL CHECK(deposit>=0),replacement_value int NOT NULL DEFAULT 0,min_days int DEFAULT 1,max_days int DEFAULT 14,photos jsonb NOT NULL DEFAULT '[]',status text NOT NULL DEFAULT 'DRAFT',reason text,created_at timestamptz DEFAULT now())`,
  );
  await events.schema(pool);
  if (process.env.DEMO_MODE === "true")
    for (const [id, title, category, rate, deposit] of [
      ["camera", "Canon EOS 90D + 50mm lens", "camera", 25000, 300000],
      ["gown", "Academic gown · size M", "clothing", 10000, 50000],
      ["racket", "Badminton racket set", "sports", 5000, 30000],
    ])
      await pool.query(
        `INSERT INTO listings(id,owner_id,title,category,description,condition,accessories,pickup_zone,daily_rate,deposit,status) VALUES($1,'owner',$2,$3,'Ready for your next campus project','Good','Case and standard accessories','Main Library', $4,$5,'PUBLISHED') ON CONFLICT DO NOTHING`,
        [id, title, category, rate, deposit],
      );
  const a = app("listing");
  a.get(
    "/listings",
    r(async (req, res) => {
      const { q = "", category = "", zone = "", start, end } = req.query;
      const { rows } = await pool.query(
        `SELECT * FROM listings WHERE status='PUBLISHED' AND (title ILIKE $1 OR description ILIKE $1) AND ($2='' OR category=$2) AND ($3='' OR pickup_zone ILIKE $3) ORDER BY created_at DESC LIMIT 50`,
        [
          `%${String(q).slice(0, 100)}%`,
          String(category),
          zone ? `%${zone}%` : "",
        ],
      );
      let items = rows;
      if (start || end) {
        const available = await rpc(
          "availability",
          { ids: rows.map((x) => x.id), start, end },
          undefined,
          req.correlation,
          true,
        );
        items = rows.filter((x) => available.includes(x.id));
      }
      res.json(items);
    }),
  );
  a.get(
    "/listings/mine",
    auth,
    r(async (req, res) =>
      res.json(
        (
          await pool.query(
            "SELECT * FROM listings WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 50",
            [req.user.sub],
          )
        ).rows,
      ),
    ),
  );
  a.get(
    "/listings/:id",
    r(async (req, res) => {
      const row = (
        await pool.query("SELECT * FROM listings WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(
        row && row.status === "PUBLISHED",
        404,
        "Published listing not found",
      );
      res.json(row);
    }),
  );
  a.post(
    "/listings",
    auth,
    r(async (req, res) => {
      const u = await eligible(req);
      assert(u.payout, 409, "Register a payout destination first");
      const b = req.body;
      const id = randomUUID();
      const min = b.minDays ?? 1,
        max = b.maxDays ?? 14;
      assert(
        Number.isInteger(min) &&
          Number.isInteger(max) &&
          min >= 1 &&
          max >= min &&
          max <= 30,
        400,
        "Rental duration must be between 1 and 30 days",
      );
      const photos = b.photos || [];
      assert(
        Array.isArray(photos) &&
          photos.length >= 1 &&
          photos.length <= 6 &&
          photos.every(
            (x) =>
              typeof x === "string" &&
              /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x) &&
              x.length < 250000,
          ),
        400,
        "Use up to 6 compressed JPEG/PNG/WebP images (each under 180 KB)",
      );
      const values = [
        id,
        u.id,
        text(b.title, "Title"),
        text(b.category, "Category"),
        text(b.description, "Description", 3000),
        text(b.condition, "Condition"),
        text(b.accessories, "Accessories", 500),
        text(b.pickupZone, "Pickup zone"),
        cents(b.dailyRate, "Daily rate"),
        cents(b.deposit, "Deposit", true),
        cents(b.replacementValue ?? 0, "Replacement value", true),
        min,
        max,
        JSON.stringify(photos),
      ];
      await pool.query(
        `INSERT INTO listings(id,owner_id,title,category,description,condition,accessories,pickup_zone,daily_rate,deposit,replacement_value,min_days,max_days,photos) VALUES(${values.map((_, i) => "$" + (i + 1)).join(",")})`,
        values,
      );
      // A failed calendar call leaves a safe draft. Publication waits for success.
      await rpc(
        "setBlackouts",
        { listingId: id, periods: b.blackouts || [] },
        req.token,
        req.correlation,
      );
      const flagged = values[10] > 1000000 || /weapon|อาวุธ/i.test(b.title);
      const row = await transaction(async (c) => {
        const { rows } = await c.query(
          "UPDATE listings SET status=$2 WHERE id=$1 RETURNING *",
          [id, flagged ? "PENDING_REVIEW" : "PUBLISHED"],
        );
        await events.event(
          c,
          flagged ? "listing.review_requested" : "listing.published",
          [u.id],
          { listingId: id, title: b.title },
          req.correlation,
        );
        return rows[0];
      });
      res.status(201).json(row);
    }),
  );
  a.put(
    "/listings/:id/calendar",
    auth,
    r(async (req, res) => {
      const l = (
        await pool.query("SELECT * FROM listings WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(
        l && l.owner_id === req.user.sub,
        403,
        "Only the owner can change availability",
      );
      res.json(
        await rpc(
          "setBlackouts",
          { listingId: l.id, periods: req.body.periods || [] },
          req.token,
          req.correlation,
        ),
      );
    }),
  );
  a.post(
    "/listings/:id/unpublish",
    auth,
    r(async (req, res) => {
      const { rows } = await pool.query(
        `UPDATE listings SET status='DRAFT' WHERE id=$1 AND owner_id=$2 RETURNING *`,
        [req.params.id, req.user.sub],
      );
      assert(rows[0], 403, "Only the owner can unpublish");
      res.json(rows[0]);
    }),
  );
  a.get(
    "/admin/listings",
    auth,
    r(async (req, res) => {
      const u = await eligible(req);
      assert(u.role === "admin", 403, "Administrator only");
      res.json(
        (
          await pool.query(
            `SELECT * FROM listings WHERE status='PENDING_REVIEW'`,
          )
        ).rows,
      );
    }),
  );
  a.post(
    "/admin/listings/:id/moderate",
    auth,
    r(async (req, res) => {
      const u = await eligible(req);
      assert(u.role === "admin", 403, "Administrator only");
      assert(
        typeof req.body.approve === "boolean",
        400,
        "Supply approve boolean",
      );
      const row = await transaction(async (c) => {
        const { rows } = await c.query(
          `UPDATE listings SET status=$2,reason=$3 WHERE id=$1 AND status='PENDING_REVIEW' RETURNING *`,
          [
            req.params.id,
            req.body.approve ? "PUBLISHED" : "REJECTED",
            String(req.body.reason || "").slice(0, 500),
          ],
        );
        assert(rows[0], 409, "No pending listing");
        await events.event(
          c,
          "listing.moderated",
          [rows[0].owner_id],
          { status: rows[0].status },
          req.correlation,
        );
        return rows[0];
      });
      res.json(row);
    }),
  );
  a.get(
    "/internal/listings/:id",
    internal,
    r(async (req, res) => {
      const l = (
        await pool.query("SELECT * FROM listings WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(l, 404, "Listing not found");
      res.json(l);
    }),
  );
  errors(a);
  events.publisher(pool);
  a.listen(3002, () => console.log("Listing REST :3002"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
