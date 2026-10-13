const { MongoClient } = require("mongodb");
const {
  app,
  auth,
  errors,
  asyncRoute: r,
  http,
  assert,
  randomUUID,
} = require("../../shared/core");
async function main() {
  const client = await new MongoClient(process.env.MONGO_URL).connect();
  const db = client.db();
  const reviews = db.collection("reviews");
  await reviews.createIndex({ rentalId: 1, authorId: 1 }, { unique: true });
  const a = app("review");
  a.get(
    "/reviews/:studentId",
    r(async (req, res) => {
      const items = await reviews
        .find({ targetId: req.params.studentId }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      const agg = await reviews
        .aggregate([
          { $match: { targetId: req.params.studentId } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: "rating" },
            },
          },
        ])
        .toArray();
      res.json({
        count: agg[0]?.count || 0,
        average: agg[0]?.average || 0,
        items,
      });
    }),
  );
  a.post(
    "/reviews",
    auth,
    r(async (req, res) => {
      const b = req.body;
      const v = await http(
        `${process.env.RENTAL_URL}/internal/rentals/${encodeURIComponent(b.rentalId)}`,
        { service: true },
      );
      assert(
        v.state === "CLOSED",
        409,
        "Reviews open only after settlement succeeds",
      );
      assert(
        [v.owner_id, v.renter_id].includes(req.user.sub),
        403,
        "Rental participants only",
      );
      assert(
        Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5,
        400,
        "Rating must be 1–5",
      );
      assert(
        typeof b.comment === "string" &&
          b.comment.trim() &&
          b.comment.length <= 1000,
        400,
        "Write a review (max 1000 characters)",
      );
      const row = {
        id: randomUUID(),
        rentalId: v.id,
        authorId: req.user.sub,
        targetId: req.user.sub === v.owner_id ? v.renter_id : v.owner_id,
        rating: b.rating,
        comment: b.comment.trim(),
        createdAt: new Date(),
      };
      try {
        await reviews.insertOne(row);
      } catch (e) {
        if (e.code === 11000) e.status = 409;
        throw e;
      }
      delete row._id;
      res.status(201).json(row);
    }),
  );
  a.get(
    "/ready",
    r(async (req, res) => {
      await db.command({ ping: 1 });
      res.json({ status: "ok" });
    }),
  );
  errors(a);
  a.listen(3005, () => console.log("Review REST + MongoDB :3005"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
