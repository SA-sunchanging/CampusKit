const amqp = require("amqplib");
const { MongoClient } = require("mongodb");
const {
  app,
  auth,
  errors,
  asyncRoute: r,
  assert,
  http,
} = require("../../shared/core");
async function main() {
  const client = await new MongoClient(process.env.MONGO_URL).connect();
  const db = client.db();
  const inbox = db.collection("inbox");
  await inbox.createIndex({ eventId: 1, recipient: 1 }, { unique: true });
  const a = app("notification");
  let connected = false;
  a.get(
    "/notifications",
    auth,
    r(async (req, res) =>
      res.json(
        await inbox
          .find({ recipient: req.user.sub }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray(),
      ),
    ),
  );
  a.get(
    "/admin/notifications",
    auth,
    r(async (req, res) => {
      const u = await http(
        `${process.env.IDENTITY_URL}/internal/users/${req.user.sub}`,
        { service: true },
      );
      assert(u.role === "admin", 403, "Administrator only");
      res.json({
        brokerConnected: connected,
        stored: await inbox.countDocuments(),
        deliveryAdapter: "demo in-app inbox; external email/push deferred",
      });
    }),
  );
  a.get(
    "/ready",
    r(async (req, res) => {
      await db.command({ ping: 1 });
      res.json({
        mongo: "ok",
        broker: connected ? "connected" : "reconnecting",
      });
    }),
  );
  errors(a);
  a.listen(3006, () => console.log("Notification REST :3006"));
  async function consume() {
    let conn;
    try {
      conn = await amqp.connect(process.env.AMQP_URL);
      conn.on("error", () => {});
      const ch = await conn.createChannel();
      await ch.assertExchange("campuskit.events", "fanout", { durable: true });
      await ch.assertExchange("campuskit.dead", "fanout", { durable: true });
      await ch.assertQueue("notifications.dead", { durable: true });
      await ch.bindQueue("notifications.dead", "campuskit.dead", "");
      await ch.assertQueue("notifications", {
        durable: true,
        arguments: { "x-dead-letter-exchange": "campuskit.dead" },
      });
      await ch.bindQueue("notifications", "campuskit.events", "");
      await ch.prefetch(10);
      connected = true;
      conn.on("close", () => {
        connected = false;
        setTimeout(consume, 2000);
      });
      await ch.consume("notifications", async (msg) => {
        if (!msg) return;
        let event;
        try {
          event = JSON.parse(msg.content.toString());
          assert(
            event.id && Array.isArray(event.recipients) && event.type,
            400,
            "Malformed event",
          );
        } catch {
          ch.nack(msg, false, false);
          return;
        }
        try {
          for (const recipient of event.recipients)
            await inbox.updateOne(
              { eventId: event.id, recipient },
              {
                $setOnInsert: {
                  eventId: event.id,
                  recipient,
                  type: event.type,
                  data: event.data,
                  correlation: event.correlation,
                  createdAt: new Date(event.createdAt),
                  deliveredAt: new Date(),
                  channel: "in-app",
                  status: "DELIVERED",
                },
              },
              { upsert: true },
            );
          ch.ack(msg);
          console.log(
            JSON.stringify({
              service: "notification",
              event: event.id,
              type: event.type,
              correlation: event.correlation,
              delivery: "stored",
            }),
          );
        } catch (e) {
          console.error("Delivery retry", e.message);
          setTimeout(() => {
            try {
              ch.nack(msg, false, true);
            } catch {}
          }, 1000);
        }
      });
    } catch (e) {
      connected = false;
      console.warn("Broker reconnect", e.message);
      if (conn) await conn.close().catch(() => {});
      setTimeout(consume, 2000);
    }
  }
  consume();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
