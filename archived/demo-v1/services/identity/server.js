const {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  randomInt,
} = require("crypto");
const {
  app,
  auth,
  internal,
  errors,
  asyncRoute: r,
  pool,
  transaction,
  assert,
  sign,
  text,
  randomUUID,
} = require("../../shared/core");
const events = require("../../shared/events");
const hash = (password, salt = randomBytes(16).toString("hex")) =>
  `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
const matches = (password, value) => {
  const [salt, digest] = value.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 32),
    Buffer.from(digest, "hex"),
  );
};
const clean = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  verified: u.verified,
  email_verified: u.email_verified,
  suspended: u.suspended,
  payout: u.payout,
});
async function main() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,name text NOT NULL,email text UNIQUE NOT NULL,password text NOT NULL,role text NOT NULL DEFAULT 'student',email_verified boolean DEFAULT false,verified boolean DEFAULT false,suspended boolean DEFAULT false,payout text,otp text,otp_expires timestamptz,otp_attempts int DEFAULT 0)`,
  );
  await events.schema(pool);
  if (process.env.DEMO_MODE === "true")
    for (const [id, name, role] of [
      ["owner", "Mint Owner", "student"],
      ["renter", "Beam Renter", "student"],
      ["admin", "Platform Admin", "admin"],
    ])
      await pool.query(
        `INSERT INTO users(id,name,email,password,role,email_verified,verified,payout) VALUES($1,$2,$3,$4,$5,true,true,$6) ON CONFLICT DO NOTHING`,
        [
          id,
          name,
          `${id}@student.chula.ac.th`,
          hash("demo12345"),
          role,
          role === "student" ? "demo-bank-account" : null,
        ],
      );
  const a = app("identity");
  const attempts = new Map();
  function throttle(req, res, next) {
    const key = req.ip;
    const v = attempts.get(key) || { n: 0, until: Date.now() + 60000 };
    if (v.until < Date.now()) {
      v.n = 0;
      v.until = Date.now() + 60000;
    }
    v.n++;
    attempts.set(key, v);
    if (v.n > 30)
      return res
        .status(429)
        .json({ error: "Too many authentication attempts; wait one minute" });
    next();
  }
  setInterval(() => {
    for (const [k, v] of attempts) if (v.until < Date.now()) attempts.delete(k);
  }, 60000).unref();
  a.post(
    "/auth/register",
    throttle,
    r(async (req, res) => {
      const name = text(req.body.name, "Name");
      const email = text(req.body.email, "Email").toLowerCase();
      assert(
        /^[^@\s]+@(?:student\.)?chula\.ac\.th$/.test(email),
        400,
        "Use your Chula university email",
      );
      const password = text(req.body.password, "Password");
      assert(password.length >= 8, 400, "Password needs at least 8 characters");
      const code = String(randomInt(100000, 1000000));
      const u = await transaction(async (c) => {
        const { rows } = await c.query(
          `INSERT INTO users(id,name,email,password,otp,otp_expires) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes') RETURNING *`,
          [randomUUID(), name, email, hash(password), hash(code)],
        );
        await events.event(
          c,
          "identity.registered",
          [rows[0].id],
          { message: "Verify your email and request student-status review" },
          req.correlation,
        );
        return rows[0];
      });
      res.status(201).json({
        token: sign(u),
        user: clean(u),
        ...(process.env.DEMO_MODE === "true" ? { demoCode: code } : {}),
      });
    }),
  );
  a.post(
    "/auth/login",
    throttle,
    r(async (req, res) => {
      const email = text(req.body.email, "Email").toLowerCase();
      const password = text(req.body.password, "Password");
      const u = (
        await pool.query("SELECT * FROM users WHERE email=$1", [email])
      ).rows[0];
      assert(
        u && matches(password, u.password),
        401,
        "Incorrect email or password",
      );
      assert(!u.suspended, 403, "Account suspended");
      res.json({ token: sign(u), user: clean(u) });
    }),
  );
  a.get(
    "/auth/me",
    auth,
    r(async (req, res) => {
      const u = (
        await pool.query("SELECT * FROM users WHERE id=$1", [req.user.sub])
      ).rows[0];
      assert(u, 401, "Account missing");
      res.json(clean(u));
    }),
  );
  a.post(
    "/auth/verify-email",
    auth,
    r(async (req, res) => {
      const u = (
        await pool.query("SELECT * FROM users WHERE id=$1", [req.user.sub])
      ).rows[0];
      assert(
        u &&
          u.otp &&
          u.otp_attempts < 5 &&
          new Date(u.otp_expires) > new Date(),
        400,
        "Code expired or too many attempts",
      );
      await pool.query(
        "UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=$1",
        [u.id],
      );
      assert(
        matches(text(req.body.code, "Code", 6), u.otp),
        400,
        "Invalid code",
      );
      const result = await pool.query(
        "UPDATE users SET email_verified=true,otp=NULL WHERE id=$1 RETURNING *",
        [u.id],
      );
      res.json(clean(result.rows[0]));
    }),
  );
  a.put(
    "/auth/payout",
    auth,
    r(async (req, res) => {
      const payout = text(req.body.payout, "Payout destination");
      const { rows } = await pool.query(
        "UPDATE users SET payout=$2 WHERE id=$1 RETURNING *",
        [req.user.sub, payout],
      );
      res.json(clean(rows[0]));
    }),
  );
  const admin = r(async (req, res) => {
    const u = (
      await pool.query("SELECT * FROM users WHERE id=$1", [req.user.sub])
    ).rows[0];
    assert(u?.role === "admin" && !u.suspended, 403, "Administrator only");
    const { rows } = await pool.query("SELECT * FROM users ORDER BY email");
    res.json(rows.map(clean));
  });
  a.get("/admin/users", auth, admin);
  a.post(
    "/admin/users/:id/verify",
    auth,
    r(async (req, res) => {
      const actor = (
        await pool.query("SELECT * FROM users WHERE id=$1", [req.user.sub])
      ).rows[0];
      assert(
        actor?.role === "admin" && !actor.suspended,
        403,
        "Administrator only",
      );
      const u = await transaction(async (c) => {
        const { rows } = await c.query(
          "UPDATE users SET verified=true WHERE id=$1 AND email_verified=true RETURNING *",
          [req.params.id],
        );
        assert(rows[0], 409, "Verify email before student review");
        await events.event(
          c,
          "identity.verified",
          [req.params.id],
          {},
          req.correlation,
        );
        return rows[0];
      });
      res.json(clean(u));
    }),
  );
  a.get(
    "/internal/users/:id",
    internal,
    r(async (req, res) => {
      const u = (
        await pool.query("SELECT * FROM users WHERE id=$1", [req.params.id])
      ).rows[0];
      assert(u, 404, "Student not found");
      res.json(clean(u));
    }),
  );
  errors(a);
  events.publisher(pool);
  a.listen(3001, () => console.log("Identity REST :3001"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
