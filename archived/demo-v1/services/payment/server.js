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
} = require("../../shared/core");
async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS payments(id text PRIMARY KEY,renter_id text NOT NULL,owner_id text NOT NULL,fee int NOT NULL,deposit int NOT NULL,fee_authorized boolean DEFAULT false,deposit_authorized boolean DEFAULT false,authorization_expires timestamptz,fee_captured boolean DEFAULT false,deposit_released boolean DEFAULT false,late_fee int DEFAULT 0,owner_paid boolean DEFAULT false,voided boolean DEFAULT false);
 CREATE TABLE IF NOT EXISTS operations(id text PRIMARY KEY,payment_id text NOT NULL,kind text NOT NULL,amount int NOT NULL,result jsonb NOT NULL,created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS faults(kind text PRIMARY KEY,remaining int NOT NULL); CREATE TABLE IF NOT EXISTS methods(user_id text PRIMARY KEY,token text NOT NULL);`);
  if (process.env.DEMO_MODE === "true")
    for (const id of ["owner", "renter"])
      await pool.query(
        "INSERT INTO methods(user_id,token) VALUES($1,'pm_demo_success') ON CONFLICT DO NOTHING",
        [id],
      );
  const a = app("payment");
  a.put(
    "/payments/method",
    auth,
    r(async (req, res) => {
      assert(
        ["pm_demo_success", "pm_demo_decline"].includes(req.body.token),
        400,
        "Select a supported demo payment token",
      );
      await pool.query(
        "INSERT INTO methods(user_id,token) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET token=EXCLUDED.token",
        [req.user.sub, req.body.token],
      );
      res.json({ saved: true, adapter: "demo" });
    }),
  );
  async function operation(c, id, kind, amount) {
    const key = `${id}:${kind}`;
    const old = (await c.query("SELECT * FROM operations WHERE id=$1", [key]))
      .rows[0];
    if (old) {
      assert(
        old.amount === amount,
        409,
        "Idempotency key reused with a different amount",
      );
      return old.result;
    }
    const result = {
      adapter: "demo-ledger",
      kind,
      amount,
      operationId: key,
      status: "SUCCEEDED",
    };
    await c.query(
      "INSERT INTO operations(id,payment_id,kind,amount,result) VALUES($1,$2,$3,$4,$5)",
      [key, id, kind, amount, result],
    );
    return result;
  }
  // Failure tokens must be consumed outside transactions that roll back.
  async function fault(kind) {
    const { rows } = await pool.query(
      "UPDATE faults SET remaining=remaining-1 WHERE kind=$1 AND remaining>0 RETURNING *",
      [kind],
    );
    assert(!rows[0], 503, `Demo adapter declined ${kind}; safe to retry`);
  }
  a.post(
    "/internal/payments/:id/:action",
    internal,
    r(async (req, res) => {
      const { id, action } = req.params;
      assert(
        ["authorize", "capture", "settle", "void"].includes(action),
        404,
        "Unknown payment command",
      );
      const existing = (
        await pool.query("SELECT * FROM payments WHERE id=$1", [id])
      ).rows[0];
      const faultKind = {
        authorize: "AUTHORIZE_FEE",
        capture: "CAPTURE_FEE",
        settle: "PAYOUT",
        void: "VOID",
      }[action];
      if (
        !existing ||
        (action === "authorize" && !existing.fee_authorized) ||
        (action === "capture" && !existing.fee_captured) ||
        (action === "settle" && !existing.owner_paid) ||
        (action === "void" && !existing.voided)
      )
        await fault(faultKind);
      const result = await transaction(async (c) => {
        if (action === "authorize") {
          const b = req.body;
          const method = (
            await c.query("SELECT * FROM methods WHERE user_id=$1", [
              b.renterId,
            ])
          ).rows[0];
          assert(
            method,
            409,
            "Renter needs a supported payment method in Account settings",
          );
          assert(
            method.token === "pm_demo_success",
            409,
            "Demo card declined; update payment method and retry",
          );
          assert(
            Number.isSafeInteger(b.fee) &&
              b.fee > 0 &&
              Number.isSafeInteger(b.deposit) &&
              b.deposit >= 0,
            400,
            "Invalid payment amounts",
          );
          await c.query(
            `INSERT INTO payments(id,renter_id,owner_id,fee,deposit) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [id, b.renterId, b.ownerId, b.fee, b.deposit],
          );
        }
        let p = (
          await c.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (!p && action === "void") return { voided: true };
        assert(p, 404, "Payment not found");
        if (action === "authorize") {
          assert(!p.voided, 409, "Payment voided");
          assert(
            p.fee === req.body.fee &&
              p.deposit === req.body.deposit &&
              p.renter_id === req.body.renterId &&
              p.owner_id === req.body.ownerId,
            409,
            "Payment terms changed",
          );
          if (!p.fee_authorized) {
            await operation(c, id, "AUTHORIZE_FEE", p.fee);
            await operation(c, id, "AUTHORIZE_DEPOSIT", p.deposit);
            await c.query(
              `UPDATE payments SET fee_authorized=true,deposit_authorized=true,authorization_expires=now()+interval '7 days' WHERE id=$1`,
              [id],
            );
          }
        }
        if (action === "capture" && !p.fee_captured) {
          assert(
            !p.voided &&
              p.fee_authorized &&
              p.deposit_authorized &&
              new Date(p.authorization_expires) > new Date(),
            409,
            "Payment authorization expired or missing",
          );
          await operation(c, id, "CAPTURE_FEE", p.fee);
          await c.query("UPDATE payments SET fee_captured=true WHERE id=$1", [
            id,
          ]);
        }
        if (action === "settle" && !p.owner_paid) {
          assert(
            p.fee_captured && !p.voided,
            409,
            "Fee must be captured before settlement",
          );
          assert(
            new Date(p.authorization_expires) > new Date(),
            409,
            "Deposit expired; administrator recovery required",
          );
          const late = req.body.lateFee;
          assert(
            Number.isInteger(late) && late >= 0 && late <= p.deposit,
            400,
            "Invalid late fee",
          );
          await operation(c, id, "LATE_FEE", late);
          await operation(c, id, "RELEASE_DEPOSIT", p.deposit - late);
          await operation(c, id, "PAYOUT", p.fee + late);
          await c.query(
            "UPDATE payments SET late_fee=$2,deposit_released=true,owner_paid=true WHERE id=$1",
            [id, late],
          );
        }
        if (action === "void" && !p.voided) {
          assert(!p.fee_captured, 409, "Cannot void after pickup capture");
          await operation(c, id, "VOID", p.fee + p.deposit);
          await c.query(
            "UPDATE payments SET voided=true,fee_authorized=false,deposit_authorized=false,deposit_released=true WHERE id=$1",
            [id],
          );
        }
        return (await c.query("SELECT * FROM payments WHERE id=$1", [id]))
          .rows[0];
      });
      if (action === "capture") {
        const f = await pool.query(
          "UPDATE faults SET remaining=remaining-1 WHERE kind='TIMEOUT_AFTER_CAPTURE' AND remaining>0 RETURNING *",
        );
        assert(
          !f.rows[0],
          503,
          "Demo response lost after successful capture; reconcile using the same operation ID",
        );
      }
      res.json(result);
    }),
  );
  a.get(
    "/payments/:id",
    auth,
    r(async (req, res) => {
      const p = (
        await pool.query("SELECT * FROM payments WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(p, 404, "No payment yet");
      assert(
        [p.renter_id, p.owner_id].includes(req.user.sub) ||
          req.user.role === "admin",
        403,
        "Payment participants only",
      );
      res.json({
        ...p,
        operations: (
          await pool.query(
            "SELECT * FROM operations WHERE payment_id=$1 ORDER BY created_at",
            [p.id],
          )
        ).rows,
      });
    }),
  );
  a.get(
    "/internal/payments/:id",
    internal,
    r(async (req, res) => {
      const p = (
        await pool.query("SELECT * FROM payments WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(p, 404, "No payment");
      res.json(p);
    }),
  );
  a.post(
    "/admin/payment-fault",
    auth,
    r(async (req, res) => {
      const u = await http(
        `${process.env.IDENTITY_URL}/internal/users/${req.user.sub}`,
        { service: true },
      );
      assert(u.role === "admin" && !u.suspended, 403, "Administrator only");
      assert(process.env.DEMO_MODE === "true", 403, "Demo controls disabled");
      assert(
        [
          "AUTHORIZE_FEE",
          "CAPTURE_FEE",
          "TIMEOUT_AFTER_CAPTURE",
          "PAYOUT",
          "VOID",
        ].includes(req.body.kind),
        400,
        "Invalid fault kind",
      );
      await pool.query(
        "INSERT INTO faults(kind,remaining) VALUES($1,1) ON CONFLICT(kind) DO UPDATE SET remaining=1",
        [req.body.kind],
      );
      res.json({ nextFailure: req.body.kind });
    }),
  );
  errors(a);
  a.listen(3004, () => console.log("Payment REST :3004 (demo adapter)"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
