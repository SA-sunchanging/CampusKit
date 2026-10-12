function period(start, end) {
  const s = new Date(start),
    e = new Date(end);
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !Number.isFinite(+s) ||
    !Number.isFinite(+e) ||
    e <= s
  )
    throw Object.assign(
      new Error(
        "Provide a valid pickup and return timestamp, return must be later",
      ),
      { status: 400 },
    );
  return {
    start: s.toISOString(),
    end: e.toISOString(),
    days: Math.ceil((e - s) / 86400000),
  };
}
function lateFee(due, returned, daily, deposit) {
  return Math.min(
    deposit,
    Math.max(0, Math.ceil((new Date(returned) - new Date(due)) / 86400000)) *
      daily,
  );
}
module.exports = { period, lateFee };
