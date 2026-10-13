import React, { useEffect, useState, FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  email_verified: boolean;
  payout: string;
};
type Listing = {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  description: string;
  condition: string;
  accessories: string;
  pickup_zone: string;
  daily_rate: number;
  deposit: number;
  photos: string[];
  status: string;
  reason?: string;
};
type Booking = {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  start_at: string;
  end_at: string;
  status: string;
  error?: string;
  terms: {
    title: string;
    fee: number;
    deposit: number;
    days: number;
    pickupZone: string;
  };
};
type Evidence = {
  author_id: string;
  phase: string;
  condition: string;
  accessories: string;
  photos: string[];
};
type Rental = Booking & {
  state: string;
  pickup_code?: string;
  return_code?: string;
  due_at: string;
  late_fee: number;
  evidence?: Evidence[];
};
type Notice = {
  eventId: string;
  type: string;
  createdAt: string;
  data: { title?: string };
};
const money = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n / 100);
const when = (s: string) =>
  new Date(s).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const dateInput = (offset: number) => {
  const d = new Date(Date.now() + offset * 86400000);
  d.setHours(12, 0, 0, 0);
  const local = new Date(+d - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
async function photosFrom(files: FileList | null) {
  if (!files) return [];
  return Promise.all(
    Array.from(files)
      .slice(0, 3)
      .map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const image = new Image();
            const url = URL.createObjectURL(file);
            image.onload = () => {
              const scale = Math.min(
                1,
                800 / Math.max(image.width, image.height),
              );
              const c = document.createElement("canvas");
              c.width = image.width * scale;
              c.height = image.height * scale;
              c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
              URL.revokeObjectURL(url);
              const data = c.toDataURL("image/jpeg", 0.65);
              data.length < 250000
                ? resolve(data)
                : reject(new Error("Photo too large; choose a smaller image"));
            };
            image.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("Cannot read image"));
            };
            image.src = url;
          }),
      ),
  );
}
function App() {
  const [token, setToken] = useState(
    sessionStorage.getItem("campuskit-token") || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("browse");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [bookingStart, setBookingStart] = useState(dateInput(1));
  const [bookingEnd, setBookingEnd] = useState(dateInput(3));
  const [detail, setDetail] = useState<Rental | null>(null);
  const [ledger, setLedger] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [moderation, setModeration] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [register, setRegister] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [reviewSummary, setReviewSummary] = useState<{
    average: number;
    count: number;
    items: { comment: string; rating: number }[];
  } | null>(null);
  async function api<T = unknown>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function act(fn: () => Promise<void>, message = "Saved successfully") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!token) return;
    const [b, r, n, m] = await Promise.all([
      api<Booking[]>("/bookings"),
      api<Rental[]>("/rentals"),
      api<Notice[]>("/notifications"),
      api<Listing[]>("/listings/mine"),
    ]);
    setBookings(b);
    setRentals(r);
    setNotices(n);
    setMine(m);
    if (user?.role === "admin") {
      const [us, ls, ns] = await Promise.all([
        api<User[]>("/admin/users"),
        api<Listing[]>("/admin/listings"),
        api<Record<string, unknown>>("/admin/notifications"),
      ]);
      setUsers(us);
      setModeration(ls);
      setStats(ns);
    }
  }
  useEffect(() => {
    api<Listing[]>("/listings")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (token) {
      api<User>("/auth/me")
        .then(setUser)
        .catch(() => {
          setToken("");
          sessionStorage.removeItem("campuskit-token");
        });
    } else setUser(null);
  }, [token]);
  useEffect(() => {
    if (user) {
      refresh().catch((e) => setError(e.message));
      const t = setInterval(() => {
        refresh().catch(() => {});
      }, 5000);
      return () => clearInterval(t);
    }
  }, [user, tab]);
  function logout() {
    setToken("");
    setUser(null);
    sessionStorage.removeItem("campuskit-token");
    setTab("browse");
    setDetail(null);
    setLedger(null);
    setNotices([]);
    setSelected(null);
    setNotice("");
    setError("");
  }
  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await act(async () => {
      const q = new URLSearchParams();
      for (const key of ["q", "category", "zone"])
        q.set(key, String(d.get(key) || ""));
      if (d.get("start") || d.get("end")) {
        q.set("start", new Date(String(d.get("start"))).toISOString());
        q.set("end", new Date(String(d.get("end"))).toISOString());
      }
      setItems(await api(`/listings?${q}`));
    }, "Catalogue updated");
  }
  const tabs = [
    ["browse", "Discover / ค้นหา"],
    ["publish", "List an item / ลงสินค้า"],
    ["activity", "My rentals / การเช่า"],
    ["inbox", `Inbox / แจ้งเตือน (${notices.length})`],
    ...(user?.role === "admin" ? [["admin", "Admin"]] : []),
  ];
  return (
    <>
      <header>
        <a className="brand" href="#" onClick={() => setTab("browse")}>
          <span className="brand-icon">ck</span>CampusKit
          <span className="brand-caption">CHULA STUDENT COMMUNITY</span>
        </a>
        <div className="account">
          {user ? (
            <>
              <span>
                <button
                  className="account-link"
                  onClick={() => setTab("profile")}
                >
                  {user.name}
                </button>
                <small>
                  {user.verified
                    ? "Verified student ✓"
                    : "Awaiting student verification"}
                </small>
              </span>
              <button className="ghost" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <button onClick={() => setTab("login")}>Sign in →</button>
          )}
        </div>
      </header>
      <main>
        <nav aria-label="Main navigation">
          {tabs.map(([id, label]) => (
            <button
              className={tab === id ? "nav active" : "nav"}
              key={id}
              onClick={() => {
                setTab(id);
                setDetail(null);
                setLedger(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="alert success">
            {notice}
          </div>
        )}
        {busy && (
          <p role="status" className="working">
            Working…
          </p>
        )}
        {!user && ["publish", "activity", "inbox", "admin"].includes(tab) && (
          <section className="panel">
            <h2>Your campus, connected.</h2>
            <p>
              Sign in to share equipment, book a rental, and record handovers.
            </p>
            <button onClick={() => setTab("login")}>
              Sign in / เข้าสู่ระบบ
            </button>
          </section>
        )}
        {tab === "login" && (
          <section className="auth-layout">
            <div>
              <p className="eyebrow">
                A SMALLER FOOTPRINT. A BIGGER POSSIBILITY.
              </p>
              <h1>
                Borrow a little.
                <br />
                Do a lot.
              </h1>
              <p>
                กล้องสำหรับโปรเจกต์ ชุดสำหรับวันสำคัญ
                <br />
                และอุปกรณ์สำหรับไอเดียถัดไป — จากเพื่อนในมหาวิทยาลัย
              </p>
              <div className="demo-box">
                <b>Demo accounts</b>
                <p>เลือกบัญชีแล้วกด Sign in • password: demo12345</p>
                {["owner", "renter", "admin"].map((x) => (
                  <button
                    className="ghost"
                    key={x}
                    onClick={() => {
                      setRegister(false);
                      const el =
                        document.querySelector<HTMLInputElement>("#email");
                      if (el) el.value = `${x}@student.chula.ac.th`;
                      const pw =
                        document.querySelector<HTMLInputElement>("#password");
                      if (pw) pw.value = "demo12345";
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(
                  async () => {
                    const data = await api<{
                      token: string;
                      user: User;
                      demoCode?: string;
                    }>(register ? "/auth/register" : "/auth/login", "POST", {
                      email: d.get("email"),
                      password: d.get("password"),
                      name: d.get("name"),
                    });
                    sessionStorage.setItem("campuskit-token", data.token);
                    setToken(data.token);
                    setUser(data.user);
                    setTab(data.demoCode ? "profile" : "browse");
                    if (data.demoCode) setDemoCode(data.demoCode);
                  },
                  register
                    ? "Account created. Verify email and ask admin to review your student status."
                    : "Welcome to CampusKit",
                );
              }}
            >
              <h2>{register ? "Join the community" : "Welcome back"}</h2>
              {register && (
                <label>
                  Name
                  <input name="name" required />
                </label>
              )}
              <label>
                University email
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="student@student.chula.ac.th"
                />
              </label>
              <label>
                Password
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                />
              </label>
              <button disabled={busy}>
                {register ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Already a member? Sign in"
                  : "New here? Create an account"}
              </button>
            </form>
          </section>
        )}
        {user && (tab === "profile" || !user.verified) && (
          <section className="panel compact">
            <h3>Account & verification</h3>
            {demoCode && !user.email_verified && (
              <p>
                Demo email verification code: <b>{demoCode}</b>
              </p>
            )}
            <p>
              Email verification proves address control; an administrator
              reviews current student status separately.
            </p>
            {!user.email_verified && (
              <form
                className="inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  act(async () =>
                    setUser(
                      await api("/auth/verify-email", "POST", {
                        code: d.get("code"),
                      }),
                    ),
                  );
                }}
              >
                <label>
                  Email code
                  <input name="code" required pattern="[0-9]{6}" />
                </label>
                <button disabled={busy}>Verify email</button>
              </form>
            )}
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () =>
                  setUser(
                    await api("/auth/payout", "PUT", {
                      payout: d.get("payout"),
                    }),
                  ),
                );
              }}
            >
              <label>
                Demo payout destination
                <input
                  name="payout"
                  defaultValue={user.payout || ""}
                  required
                />
              </label>
              <button disabled={busy}>Save destination</button>
            </form>
            <form
              className="inline"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                act(async () => {
                  await api("/payments/method", "PUT", {
                    token: d.get("token"),
                  });
                }, "Demo payment method saved");
              }}
            >
              <label>
                Payment adapter token
                <select name="token">
                  <option value="pm_demo_success">Demo card · succeeds</option>
                  <option value="pm_demo_decline">Demo card · declines</option>
                </select>
              </label>
              <button disabled={busy}>Save payment method</button>
            </form>
            <button
              className="ghost"
              disabled={busy}
              onClick={() =>
                act(
                  async () => setUser(await api<User>("/auth/me")),
                  "Verification status refreshed",
                )
              }
            >
              Refresh verification status
            </button>
          </section>
        )}
        {tab === "browse" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">OWN LESS. EXPERIENCE MORE.</p>
                <h1>
                  Your next idea,
                  <br />
                  already on campus.
                </h1>
                <p>เช่าอุปกรณ์จากเพื่อนนิสิต จองวันรับ–คืนได้ในที่เดียว</p>
                <div className="hero-tags">
                  <span>Verified students</span>
                  <span>Secure reservations</span>
                  <span>From ฿50 / day</span>
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <span className="circle c1">📷</span>
                <span className="circle c2">🏸</span>
                <span className="circle c3">🎓</span>
                <p>
                  SHARE SOMETHING.
                  <br />
                  MAKE SOMETHING.
                </p>
              </div>
            </section>
            <form className="search panel" onSubmit={search}>
              <label>
                Search
                <input name="q" placeholder="Camera, gown, sports…" />
              </label>
              <label>
                Category
                <select name="category">
                  <option value="">All categories</option>
                  {[
                    "camera",
                    "clothing",
                    "sports",
                    "tools",
                    "outdoor",
                    "other",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Campus pickup
                <input name="zone" placeholder="Main Library" />
              </label>
              <label>
                Pickup
                <input name="start" type="datetime-local" />
              </label>
              <label>
                Return
                <input name="end" type="datetime-local" />
              </label>
              <button disabled={busy}>Find equipment</button>
            </form>
            <div className="section-heading">
              <h2>Find your next possibility</h2>
              <span>{items.length} available listings</span>
            </div>
            <div className="grid">
              {items.map((l) => (
                <article className="listing card" key={l.id}>
                  <div className={"listing-image " + l.category}>
                    {l.photos.length ? (
                      <img src={l.photos[0]} alt={l.title} />
                    ) : (
                      <span aria-hidden="true">
                        {l.category === "camera"
                          ? "📷"
                          : l.category === "sports"
                            ? "🏸"
                            : l.category === "clothing"
                              ? "🎓"
                              : "🧰"}
                      </span>
                    )}
                    <span className="category-tag">{l.category}</span>
                  </div>
                  <div className="card-body">
                    <h3>{l.title}</h3>
                    <p>{l.description}</p>
                    <p className="muted">⌖ {l.pickup_zone}</p>
                    <div className="card-bottom">
                      <b>
                        {money(l.daily_rate)}
                        <small> / day</small>
                      </b>
                      <button
                        onClick={() => {
                          setSelected(l);
                          setBookingStart(dateInput(1));
                          setBookingEnd(dateInput(3));
                          setReviewSummary(null);
                          api<typeof reviewSummary>(`/reviews/${l.owner_id}`)
                            .then(setReviewSummary)
                            .catch(() => {});
                        }}
                      >
                        View & book →
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {items.length === 0 && (
              <p className="empty">
                No listings match these filters. Try different dates or
                categories.
              </p>
            )}
          </>
        )}
        {selected && tab === "browse" && (
          <section
            className="panel booking-panel"
            role="region"
            aria-label="Book selected item"
          >
            <div className="section-heading">
              <h2>{selected.title}</h2>
              <button className="ghost" onClick={() => setSelected(null)}>
                Close ×
              </button>
            </div>
            <p>
              {selected.condition} · {selected.accessories}
            </p>
            <p>
              Deposit {money(selected.deposit)} · Full reversal before pickup ·
              Late fee: each started overdue day at daily rate, capped at
              deposit.
            </p>
            {reviewSummary && (
              <p>
                Owner reputation:{" "}
                {reviewSummary.count
                  ? `${reviewSummary.average.toFixed(1)} / 5 · ${reviewSummary.count} reviews`
                  : "New to the community"}
                {reviewSummary.items.slice(0, 2).map((x, i) => (
                  <span className="review-line" key={i}>
                    {x.rating}★ {x.comment}
                  </span>
                ))}
              </p>
            )}
            {user ? (
              <>
                <p className="quote">
                  Estimated rental fee:{" "}
                  <b>
                    {money(
                      Math.max(
                        0,
                        Math.ceil(
                          (+new Date(bookingEnd) - +new Date(bookingStart)) /
                            86400000,
                        ),
                      ) * selected.daily_rate,
                    )}
                  </b>{" "}
                  · Deposit: {money(selected.deposit)}. The server freezes the
                  agreed quote when the request is created.
                </p>
                <form
                  className="inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    act(async () => {
                      await api("/bookings", "POST", {
                        listingId: selected.id,
                        start: new Date(String(d.get("start"))).toISOString(),
                        end: new Date(String(d.get("end"))).toISOString(),
                      });
                      setSelected(null);
                      setTab("activity");
                      await refresh();
                    }, "Request sent. The owner will approve before payment authorization.");
                  }}
                >
                  <label>
                    Pickup
                    <input
                      name="start"
                      type="datetime-local"
                      value={bookingStart}
                      onChange={(e) => setBookingStart(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Return
                    <input
                      name="end"
                      type="datetime-local"
                      value={bookingEnd}
                      onChange={(e) => setBookingEnd(e.target.value)}
                      required
                    />
                  </label>
                  <button disabled={busy || selected.owner_id === user.id}>
                    Request rental
                  </button>
                </form>
              </>
            ) : (
              <button onClick={() => setTab("login")}>
                Sign in to request
              </button>
            )}
          </section>
        )}
        {user && tab === "publish" && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">LET YOUR EQUIPMENT DO MORE</p>
                <h1>Share with your campus.</h1>
              </div>
            </div>
            <form
              className="panel form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const d = new FormData(form);
                const f = form.elements.namedItem("photos") as HTMLInputElement;
                act(async () => {
                  const blackouts =
                    d.get("blackoutStart") && d.get("blackoutEnd")
                      ? [
                          {
                            start: new Date(
                              String(d.get("blackoutStart")),
                            ).toISOString(),
                            end: new Date(
                              String(d.get("blackoutEnd")),
                            ).toISOString(),
                          },
                        ]
                      : [];
                  await api("/listings", "POST", {
                    title: d.get("title"),
                    category: d.get("category"),
                    description: d.get("description"),
                    condition: d.get("condition"),
                    accessories: d.get("accessories"),
                    pickupZone: d.get("pickupZone"),
                    dailyRate: Number(d.get("dailyRate")),
                    deposit: Number(d.get("deposit")),
                    replacementValue: Number(d.get("replacementValue")),
                    minDays: Number(d.get("minDays")),
                    maxDays: Number(d.get("maxDays")),
                    photos: await photosFrom(f.files),
                    blackouts,
                  });
                  form.reset();
                  await refresh();
                  setItems(await api("/listings"));
                }, "Listing saved. Items above ฿10,000 replacement value require moderation.");
              }}
            >
              <label>
                Item title
                <input
                  name="title"
                  required
                  placeholder="What would you like to share?"
                />
              </label>
              <label>
                Category
                <select name="category">
                  {[
                    "camera",
                    "clothing",
                    "sports",
                    "tools",
                    "outdoor",
                    "other",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="span2">
                Description
                <textarea name="description" required />
              </label>
              <label>
                Condition
                <input name="condition" required defaultValue="Good / สภาพดี" />
              </label>
              <label>
                Included accessories
                <input
                  name="accessories"
                  required
                  placeholder="Lens, charger, case…"
                />
              </label>
              <label>
                Daily rate (THB)
                <input
                  name="dailyRate"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  defaultValue="150"
                />
              </label>
              <label>
                Deposit (THB)
                <input
                  name="deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue="1000"
                />
              </label>
              <label>
                Replacement value (THB)
                <input
                  name="replacementValue"
                  type="number"
                  min="0"
                  defaultValue="5000"
                  required
                />
              </label>
              <label>
                Pickup location
                <input name="pickupZone" required defaultValue="Main Library" />
              </label>
              <label>
                Minimum rental days
                <input
                  name="minDays"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                Maximum rental days
                <input
                  name="maxDays"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="14"
                  required
                />
              </label>
              <label>
                Unavailable from (optional)
                <input name="blackoutStart" type="datetime-local" />
              </label>
              <label>
                Unavailable until (optional)
                <input name="blackoutEnd" type="datetime-local" />
              </label>
              <label className="span2">
                Item photographs
                <input
                  name="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  required
                />
              </label>
              <div className="span2">
                <button disabled={busy || !user.verified}>
                  Publish listing / ลงสินค้า
                </button>
              </div>
            </form>
            <h2>Your listings</h2>
            <div className="grid">
              {mine.map((l) => (
                <article className="card card-body" key={l.id}>
                  <span className="badge">{l.status}</span>
                  <h3>{l.title}</h3>
                  <p>{l.reason}</p>
                  <div className="actions">
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await api(`/listings/${l.id}/unpublish`, "POST", {});
                          await refresh();
                          setItems(await api("/listings"));
                        })
                      }
                    >
                      Unpublish
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      act(async () => {
                        await api(`/listings/${l.id}/calendar`, "PUT", {
                          periods:
                            d.get("start") && d.get("end")
                              ? [
                                  {
                                    start: new Date(
                                      String(d.get("start")),
                                    ).toISOString(),
                                    end: new Date(
                                      String(d.get("end")),
                                    ).toISOString(),
                                  },
                                ]
                              : [],
                        });
                      });
                    }}
                  >
                    <p className="muted">
                      Replace unavailable dates (empty = clear)
                    </p>
                    <label>
                      Unavailable from
                      <input name="start" type="datetime-local" />
                    </label>
                    <label>
                      Unavailable until
                      <input name="end" type="datetime-local" />
                    </label>
                    <button className="ghost" disabled={busy}>
                      Save calendar
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </>
        )}
        {user && tab === "activity" && (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">FROM REQUEST TO RETURN</p>
                <h1>My rentals.</h1>
              </div>
              <button
                className="ghost"
                onClick={() => act(refresh, "Activity refreshed")}
              >
                Refresh
              </button>
            </div>
            <h2>Bookings & approvals</h2>
            <div className="grid">
              {bookings.map((b) => (
                <article className="card card-body" key={b.id}>
                  <span className={"badge " + b.status}>{b.status}</span>
                  <h3>{b.terms.title}</h3>
                  <p>
                    {when(b.start_at)}
                    <br />→ {when(b.end_at)}
                  </p>
                  <p>
                    Rental {money(b.terms.fee)} · Deposit{" "}
                    {money(b.terms.deposit)}
                  </p>
                  <p className="muted">
                    {b.owner_id === user.id
                      ? "You are the owner"
                      : "You are the renter"}{" "}
                    · {b.id.slice(0, 8)}
                  </p>
                  {b.error && (
                    <p role="alert" className="error-text">
                      {b.error}
                    </p>
                  )}
                  <div className="actions">
                    {b.owner_id === user.id &&
                      ["PENDING", "PAYMENT_FAILED"].includes(b.status) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              const result = await api<Booking>(
                                `/bookings/${b.id}/approve`,
                                "POST",
                                {},
                              );
                              await refresh();
                              if (result.status !== "CONFIRMED")
                                throw new Error(
                                  result.error ||
                                    "Approval pending; retry safely",
                                );
                            }, "Booking confirmed. Fee and deposit authorized.")
                          }
                        >
                          Approve & authorize
                        </button>
                      )}
                    {["PENDING", "CONFIRMED", "PAYMENT_FAILED"].includes(
                      b.status,
                    ) && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            await api(`/bookings/${b.id}/cancel`, "POST", {});
                            await refresh();
                          }, "Booking cancelled and authorization reversed")
                        }
                      >
                        Cancel / decline
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {bookings.length === 0 && (
              <p className="empty">Your first rental starts in Discover.</p>
            )}
            <h2>Handover & settlement</h2>
            <div className="grid">
              {rentals.map((v) => (
                <article className="card card-body" key={v.id}>
                  <span className={"badge " + v.state}>{v.state}</span>
                  <h3>{v.terms.title}</h3>
                  <p>Due {when(v.due_at)}</p>
                  <p>
                    {v.state === "CLOSED"
                      ? "Settlement complete ✓"
                      : "Record condition with the other participant before handover."}
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        setDetail(await api(`/rentals/${v.id}`));
                        setLedger(null);
                      }, "Rental opened")
                    }
                  >
                    Open rental →
                  </button>
                </article>
              ))}
            </div>
            {detail && (
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    {detail.terms.title} · {detail.state}
                  </h2>
                  <button className="ghost" onClick={() => setDetail(null)}>
                    Close ×
                  </button>
                </div>
                <p>
                  Pickup code: {detail.pickup_code || "Shown to owner only"} ·
                  Return code: {detail.return_code || "Shown to renter only"}
                </p>
                <p className="muted">
                  Share the code with the other participant at handover. Demo
                  mode permits early pickup for a short presentation.
                </p>
                {detail.error && <p className="error-text">{detail.error}</p>}
                {["AWAITING_PICKUP", "ACTIVE", "OVERDUE"].includes(
                  detail.state,
                ) && (
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const d = new FormData(form);
                      act(async () => {
                        await api(`/rentals/${detail.id}/evidence`, "POST", {
                          phase:
                            detail.state === "AWAITING_PICKUP"
                              ? "pickup"
                              : "return",
                          condition: d.get("condition"),
                          accessories: d.get("accessories"),
                          photos: await photosFrom(
                            (
                              form.elements.namedItem(
                                "photos",
                              ) as HTMLInputElement
                            ).files,
                          ),
                        });
                        setDetail(await api(`/rentals/${detail.id}`));
                      }, "Your condition evidence recorded");
                    }}
                  >
                    <h3 className="span2">
                      Your{" "}
                      {detail.state === "AWAITING_PICKUP" ? "pickup" : "return"}{" "}
                      evidence
                    </h3>
                    <label>
                      Item condition
                      <input
                        name="condition"
                        required
                        defaultValue="Good, no visible damage"
                      />
                    </label>
                    <label>
                      Accessories checked
                      <input
                        name="accessories"
                        required
                        defaultValue="All listed accessories present"
                      />
                    </label>
                    <label className="span2">
                      Condition photographs (required)
                      <input
                        name="photos"
                        type="file"
                        accept="image/*"
                        multiple
                        required
                      />
                    </label>
                    <div className="span2">
                      <button disabled={busy}>Save my evidence</button>
                    </div>
                  </form>
                )}
                <div className="evidence-grid">
                  {detail.evidence?.map((e, i) => (
                    <div className="evidence" key={i}>
                      <b>
                        {e.author_id === user.id ? "You" : "Other participant"}{" "}
                        · {e.phase}
                      </b>
                      <p>
                        {e.condition} · {e.accessories}
                      </p>
                      {e.photos.map((p, j) => (
                        <img
                          src={p}
                          alt={`${e.phase} condition record ${j + 1}`}
                          key={j}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {((detail.state === "AWAITING_PICKUP" &&
                  detail.renter_id === user.id) ||
                  (["ACTIVE", "OVERDUE"].includes(detail.state) &&
                    detail.owner_id === user.id)) && (
                  <form
                    className="inline"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      act(async () => {
                        const phase =
                          detail.state === "AWAITING_PICKUP"
                            ? "pickup"
                            : "return";
                        const updated = await api<Rental>(
                          `/rentals/${detail.id}/${phase}`,
                          "POST",
                          { code: d.get("code"), accepted: true },
                        );
                        setDetail(await api(`/rentals/${detail.id}`));
                        await refresh();
                        if (updated.error) throw new Error(updated.error);
                      }, "Handover recorded. Payment status updated.");
                    }}
                  >
                    <label>
                      One-time code from other participant
                      <input name="code" pattern="[0-9]{6}" required />
                    </label>
                    <button disabled={busy}>
                      {detail.state === "AWAITING_PICKUP"
                        ? "Confirm pickup & capture fee"
                        : "Accept return & settle"}
                    </button>
                  </form>
                )}
                {detail.state === "SETTLEMENT_PENDING" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const v = await api<Rental>(
                          `/rentals/${detail.id}/settle`,
                          "POST",
                          {},
                        );
                        setDetail(await api(`/rentals/${detail.id}`));
                        await refresh();
                        if (v.error) throw new Error(v.error);
                      }, "Settlement completed")
                    }
                  >
                    Retry unfinished settlement
                  </button>
                )}
                <button
                  className="ghost"
                  onClick={() =>
                    act(
                      async () =>
                        setLedger(await api(`/payments/${detail.id}`)),
                      "Payment ledger loaded",
                    )
                  }
                >
                  Show payment ledger
                </button>
                {ledger && (
                  <div className="ledger">
                    <h3>Demo payment ledger · amounts in satang</h3>
                    <pre>{JSON.stringify(ledger, null, 2)}</pre>
                  </div>
                )}
                {detail.state === "CLOSED" &&
                  [detail.owner_id, detail.renter_id].includes(user.id) && (
                    <form
                      className="inline"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const d = new FormData(form);
                        act(async () => {
                          await api("/reviews", "POST", {
                            rentalId: detail.id,
                            rating: Number(d.get("rating")),
                            comment: d.get("comment"),
                          });
                          form.reset();
                        }, "Review saved in MongoDB");
                      }}
                    >
                      <label>
                        Rating
                        <select name="rating">
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n} stars
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Review
                        <input
                          name="comment"
                          required
                          maxLength={1000}
                          placeholder="How was your rental?"
                        />
                      </label>
                      <button disabled={busy}>Submit review</button>
                    </form>
                  )}
              </section>
            )}
          </>
        )}
        {user && tab === "inbox" && (
          <>
            <p className="eyebrow">RABBITMQ → NOTIFICATION SERVICE → MONGODB</p>
            <h1>Stay in the loop.</h1>
            <p>
              Events are stored in your in-app inbox. Email delivery uses a demo
              adapter in this iteration.
            </p>
            <section className="panel">
              {notices.map((n) => (
                <article className="notice" key={n.eventId}>
                  <span className="notice-icon">↗</span>
                  <div>
                    <h3>
                      {n.type.replaceAll(".", " · ").replaceAll("_", " ")}
                    </h3>
                    <p>
                      {n.data.title || "Your rental activity has been updated."}
                    </p>
                    <small>
                      {when(n.createdAt)} · event {n.eventId.slice(0, 8)}
                    </small>
                  </div>
                </article>
              ))}
              {notices.length === 0 && (
                <p className="empty">Your next update will appear here.</p>
              )}
            </section>
          </>
        )}
        {user?.role === "admin" && tab === "admin" && (
          <>
            <p className="eyebrow">PLATFORM OPERATIONS</p>
            <h1>Keep the campus moving.</h1>
            <section className="panel">
              <h2>Student verification</h2>
              <p>
                Demo manual review: email verification alone does not establish
                current student status.
              </p>
              {users.map((u) => (
                <div className="admin-row" key={u.id}>
                  <div>
                    <b>{u.name}</b>
                    <p>{u.email}</p>
                  </div>
                  <span className="badge">
                    {u.verified
                      ? "VERIFIED"
                      : u.email_verified
                        ? "EMAIL VERIFIED"
                        : "EMAIL PENDING"}
                  </span>
                  {!u.verified && (
                    <button
                      disabled={busy || !u.email_verified}
                      onClick={() =>
                        act(async () => {
                          await api(`/admin/users/${u.id}/verify`, "POST", {});
                          await refresh();
                        })
                      }
                    >
                      Approve student
                    </button>
                  )}
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Listing moderation</h2>
              {moderation.map((l) => (
                <div className="admin-row" key={l.id}>
                  <b>{l.title}</b>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api(`/admin/listings/${l.id}/moderate`, "POST", {
                          approve: true,
                        });
                        await refresh();
                      })
                    }
                  >
                    Approve listing
                  </button>
                  <button
                    className="ghost"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api(`/admin/listings/${l.id}/moderate`, "POST", {
                          approve: false,
                          reason: "Outside permitted equipment scope",
                        });
                        await refresh();
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              ))}
              {!moderation.length && <p>No listings awaiting review.</p>}
            </section>
            <section className="panel">
              <h2>Recovery & reliability demo</h2>
              <p>
                Fail one next operation, then retry the affected booking/rental
                to demonstrate idempotent recovery.
              </p>
              <div className="actions">
                {[
                  "AUTHORIZE_FEE",
                  "CAPTURE_FEE",
                  "TIMEOUT_AFTER_CAPTURE",
                  "PAYOUT",
                  "VOID",
                ].map((kind) => (
                  <button
                    disabled={busy}
                    className="ghost"
                    key={kind}
                    onClick={() =>
                      act(async () => {
                        await api("/admin/payment-fault", "POST", { kind });
                      }, `Next ${kind} will fail once`)
                    }
                  >
                    Fail {kind}
                  </button>
                ))}
              </div>
              <pre>{JSON.stringify(stats, null, 2)}</pre>
              <p>
                Settlement pending rentals appear in My rentals. Financial steps
                use stable unique operation IDs.
              </p>
            </section>
          </>
        )}
        <footer>
          <span>CampusKit · Made for possibilities.</span>
          <span>Course demo • THB • PostgreSQL + MongoDB + RabbitMQ</span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
