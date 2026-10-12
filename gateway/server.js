const path = require("path");
const { app, auth, errors, asyncRoute: r, http } = require("../shared/core");
const { rpc } = require("../shared/booking-client");
const a = app("gateway");
const targets = {
  auth: process.env.IDENTITY_URL,
  admin: null,
  listings: process.env.LISTING_URL,
  rentals: process.env.RENTAL_URL,
  payments: process.env.PAYMENT_URL,
  reviews: process.env.REVIEW_URL,
  notifications: process.env.NOTIFICATION_URL,
};
const routes = {
  users: process.env.IDENTITY_URL,
  listings: process.env.LISTING_URL,
  "payment-fault": process.env.PAYMENT_URL,
  notifications: process.env.NOTIFICATION_URL,
};
a.use(
  "/api/bookings",
  auth,
  r(async (req, res) => {
    const parts = req.path.split("/").filter(Boolean);
    const method =
      req.method === "GET"
        ? parts[0]
          ? "getBooking"
          : "listBookings"
        : req.method === "POST"
          ? parts[1] === "approve"
            ? "approveBooking"
            : parts[1] === "cancel"
              ? "cancelBooking"
              : parts.length === 0
                ? "requestBooking"
                : null
          : null;
    if (!method)
      return res.status(404).json({ error: "Unknown booking route" });
    const data = await rpc(
      method,
      { ...req.body, ...(parts[0] ? { id: parts[0] } : {}) },
      req.token,
      req.correlation,
    );
    res.status(method === "requestBooking" ? 201 : 200).json(data);
  }),
);
a.use("/api", (req, res, next) => {
  const publicRoute =
    (req.method === "POST" &&
      ["/auth/login", "/auth/register"].includes(req.path)) ||
    (req.method === "GET" &&
      (req.path === "/listings" ||
        (/^\/listings\/[^/]+$/.test(req.path) &&
          req.path !== "/listings/mine") ||
        req.path.startsWith("/reviews/")));
  if (publicRoute) return next();
  return auth(req, res, next);
});
a.use(
  "/api",
  r(async (req, res) => {
    const parts = req.path.split("/").filter(Boolean);
    const target = parts[0] === "admin" ? routes[parts[1]] : targets[parts[0]];
    if (!target) return res.status(404).json({ error: "API route not found" });
    const token = (req.get("authorization") || "").replace(/^Bearer /, "");
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : req.body;
    const data = await http(`${target}${req.url}`, {
      method: req.method,
      body,
      token,
      correlation: req.correlation,
    });
    res
      .status(
        req.method === "POST" &&
          (req.path === "/listings" ||
            req.path === "/reviews" ||
            req.path === "/auth/register")
          ? 201
          : 200,
      )
      .json(data);
  }),
);
a.use(require("express").static(path.join(__dirname, "../web/dist")));
a.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "../web/dist/index.html")),
);
errors(a);
a.listen(8080, () => console.log("CampusKit http://localhost:8080"));
