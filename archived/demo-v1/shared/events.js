const amqp = require("amqplib");
const { randomUUID } = require("crypto");
let connection,
  channel,
  busy = false;
async function schema(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS outbox(id uuid PRIMARY KEY, payload jsonb NOT NULL, sent_at timestamptz, created_at timestamptz DEFAULT now())`,
  );
}
async function event(db, type, recipients, data = {}, correlation) {
  const id = randomUUID();
  await db.query("INSERT INTO outbox(id,payload) VALUES($1,$2)", [
    id,
    {
      id,
      type,
      recipients: [...new Set(recipients)],
      data,
      correlation: correlation || id,
      createdAt: new Date().toISOString(),
    },
  ]);
}
function publisher(pool) {
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      if (!channel) {
        connection = await amqp.connect(process.env.AMQP_URL);
        connection.on("error", () => {});
        connection.on("close", () => {
          channel = null;
        });
        channel = await connection.createConfirmChannel();
        await channel.assertExchange("campuskit.events", "fanout", {
          durable: true,
        });
        await channel.assertExchange("campuskit.dead", "fanout", {
          durable: true,
        });
        await channel.assertQueue("notifications", {
          durable: true,
          arguments: { "x-dead-letter-exchange": "campuskit.dead" },
        });
        await channel.bindQueue("notifications", "campuskit.events", "");
      }
      const { rows } = await pool.query(
        "SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 50",
      );
      for (const row of rows) {
        await new Promise((resolve, reject) =>
          channel.publish(
            "campuskit.events",
            "",
            Buffer.from(JSON.stringify(row.payload)),
            {
              persistent: true,
              messageId: row.id,
              contentType: "application/json",
            },
            (err) => (err ? reject(err) : resolve()),
          ),
        );
        await pool.query("UPDATE outbox SET sent_at=now() WHERE id=$1", [
          row.id,
        ]);
      }
    } catch (e) {
      console.warn("Outbox pending:", e.message);
      channel = null;
      if (connection) await connection.close().catch(() => {});
    } finally {
      busy = false;
    }
  }, 1000);
  timer.unref();
}
module.exports = { schema, event, publisher };
