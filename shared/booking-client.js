const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const path = require("path");
const proto = grpc.loadPackageDefinition(
  loader.loadSync(path.join(__dirname, "../grpc/booking.proto")),
).campuskit;
const client = new proto.BookingService(
  process.env.BOOKING_ADDR || "booking:50051",
  grpc.credentials.createInsecure(),
);
async function rpc(method, body = {}, token, correlation, service = false) {
  const m = new grpc.Metadata();
  if (token) m.set("authorization", `Bearer ${token}`);
  if (service) m.set("x-service-token", process.env.INTERNAL_SECRET);
  if (correlation) m.set("x-correlation-id", correlation);
  return new Promise((resolve, reject) =>
    client[method](
      { json: JSON.stringify(body) },
      m,
      { deadline: Date.now() + 12000 },
      (e, r) => {
        if (e) {
          const mapping = {
            3: 400,
            5: 404,
            6: 409,
            7: 403,
            9: 409,
            16: 401,
            14: 503,
            4: 503,
          };
          reject(
            Object.assign(new Error(e.details), {
              status: mapping[e.code] || 500,
            }),
          );
        } else resolve(JSON.parse(r.json));
      },
    ),
  );
}
module.exports = { rpc };
