"""Figure 7.1: Service discovery on Docker Compose (UML deployment diagram)."""

from uml import ACCENT, FS, INK, Svg, width, wrap

W = 1600
svg = Svg(W, 1000)  # height set at the end
D = 12  # depth of a container node

# Columns inside the network node
LANES_L = [62, 90, 118]             # gateway lanes to column A, outer to inner
AX, AW = 210, 310                   # column A: payment, identity, listing, DNS
CX, CW = 695, 250                   # centre: gateway, postgres, rabbitmq, mongo
BX, BW = 1112, 310                  # column B: booking, rental, notification, review
LANES_R = [1530, 1506, 1482, 1458]  # gateway lanes to column B, outer to inner

DEV_Y, NET_Y, TOP_Y = 40, 140, 262
ROW0, PITCH, SVC_H = 612, 266, 236
ROWS = [ROW0 + i * PITCH for i in range(4)]
NET_BOTTOM = ROWS[3] + SVC_H + 40
DEV_BOTTOM = NET_BOTTOM + 34


def container(x, y, w, h, name):
    svg.node(x, y, w, h, depth=D)
    svg.text(x + w / 2, y + 40, "<<container>>", anchor="middle")
    svg.text(x + w / 2, y + 80, name, bold=True, anchor="middle")


def service(x, y, name, port, health="GET /health"):
    container(x, y, AW, SVC_H, "%s:%s" % (name, port))
    ax, ay, aw, ah = x + 18, y + 100, AW - 36, SVC_H - 116
    svg.rect(ax, ay, aw, ah, sw=2)
    svg.artifact_icon(ax + aw - 34, ay + 10)
    svg.text(ax + aw / 2, ay + 36, "<<artifact>>", anchor="middle")
    svg.text(ax + aw / 2, ay + 74, "%s app" % name, anchor="middle")
    svg.text(ax + aw / 2, ay + 110, health, anchor="middle")


def infra(y, name, host_port):
    h = 190
    container(CX, y, CW, h, name)
    svg.text(CX + CW / 2, y + 122, "host %s" % host_port, anchor="middle")
    svg.text(CX + CW / 2, y + 160, "(dev only)", anchor="middle")
    svg.port(CX + CW / 2, y + h)
    return y


def label(x, y, s, color=INK, anchor="middle"):
    """Path label on a white backing so a crossing line stays readable."""
    w = width(s)
    x0 = {"middle": x - w / 2, "start": x, "end": x - w}[anchor]
    svg.add('<rect x="%g" y="%g" width="%g" height="%g" fill="#ffffff"/>'
            % (x0 - 4, y - FS + 2, w + 8, FS + 6))
    svg.text(x, y, s, color=color, anchor=anchor)


def link(p, q, text, t=0.5, dy=0, color=INK):
    """Communication path p -> q with a protocol label at fraction t."""
    svg.arrow([p, q], color=color)
    lx = p[0] + (q[0] - p[0]) * t
    ly = p[1] + (q[1] - p[1]) * t
    return (lx, ly + 11 + dy, text, color)


# Outer nodes
svg.node(14, DEV_Y, 1556, DEV_BOTTOM - DEV_Y, depth=16, sw=3)
svg.text(40, DEV_Y + 50, "<<device>> ")
svg.text(40 + width("<<device>> "), DEV_Y + 50, "Docker host", bold=True)
svg.node(34, NET_Y, 1510, NET_BOTTOM - NET_Y, depth=D)
svg.text(56, NET_Y + 44, "<<executionEnvironment>>")
svg.text(56, NET_Y + 84, "Docker Compose network (campuskit)", bold=True)

# Edge: gateway and web, with the host ports published to the outside
GW_H = 332
container(CX, TOP_Y, CW, GW_H, "gateway:3000")
container(BX, TOP_Y, BW, 110, "web:80")
for px, host in [(CX + CW / 2, "3000"), (BX + BW / 2, "8080")]:
    svg.line(px, DEV_Y, px, TOP_Y - D)
    svg.port(px, DEV_Y)
    svg.text(px + 20, DEV_Y + 50, "host %s" % host)

# Services and DNS
for (n, p), y in zip([("payment", 3004), ("identity", 3001), ("listing", 3002)], ROWS):
    service(AX, y, n, p)
service(BX, ROWS[0], "booking", 50051, "GET /health :3007")
for (n, p), y in zip([("rental", 3003), ("notification", 3006), ("review", 3005)], ROWS[1:]):
    service(BX, y, n, p)
DNS_Y = ROWS[3] + 56
svg.component(AX, DNS_Y, AW, 130, "Embedded DNS")

# Gateway -> services: out of the gateway, along a lane, into the service
for i, (lx, r) in enumerate(zip(LANES_L, [2, 1, 0])):
    hy = TOP_Y + 138 + i * 46
    sy = ROWS[r] + 56
    svg.arrow([(CX, hy), (lx, hy), (lx, sy), (AX, sy)])
    label(CX - 16, hy - 9, "REST", anchor="end")
for i, (lx, r) in enumerate(zip(LANES_R, [3, 2, 1, 0])):
    hy = TOP_Y + 138 + i * 46
    sy = ROWS[r] + 56
    color = ACCENT if r == 0 else INK
    svg.arrow([(CX + CW + D, hy), (lx, hy), (lx, sy), (BX + BW + D, sy)], color=color)
    label(CX + CW + D + 16, hy - 9, "gRPC" if r == 0 else "REST", color=color, anchor="start")

# Infrastructure in the centre column
P_Y = infra(650, "postgres:5432", 5432)
R_Y = infra(958, "rabbitmq:5672", 5672)
M_Y = infra(1290, "mongo:27017", 27017)

AR = AX + AW + D      # right outline of a column-A node
BL = BX               # left outline of a column-B node
IL, IR = CX, CX + CW + D
labels = [
    # column A
    link((AR, ROWS[0] + 150), (IL, P_Y + 100), "SQL", 0.5),
    link((AR, ROWS[1] + 70), (IL, P_Y + 150), "SQL", 0.32),
    link((AR, ROWS[1] + 140), (IL, R_Y + 100), "AMQP", 0.3),
    link((AR, ROWS[2] + 50), (IL, P_Y + 178), "SQL", 0.62),
    link((AR, ROWS[2] + 120), (IL, R_Y + 160), "AMQP", 0.45),
    # column B
    link((BL, ROWS[0] + 150), (IR, P_Y + 100), "SQL", 0.5),
    link((BL, ROWS[0] + 210), (IR, R_Y + 60), "AMQP", 0.62),
    link((BL, ROWS[1] + 70), (IR, P_Y + 150), "SQL", 0.75),
    link((BL, ROWS[1] + 140), (IR, R_Y + 120), "AMQP", 0.45),
    link((IR, R_Y + 170), (BL, ROWS[2] + 60), "AMQP", 0.6),
    link((BL, ROWS[2] + 150), (IR, M_Y + 80), "MongoDB", 0.5),
    link((BL, ROWS[3] + 100), (IR, M_Y + 150), "MongoDB", 0.5),
]
for lx, ly, text, color in labels:
    label(lx, ly, text, color=color)

# Discovery notes below the host
NY = DEV_BOTTOM + 40
n1 = ("1. Register: Compose adds each container to DNS under its service name "
      "when it starts.")
n2 = ("2. Resolve: the caller reads e.g. LISTING_URL=http://listing:3002 and "
      "asks DNS for 'listing'.")
n3 = ("3. Health: GET /health on each service; Compose health checks gate "
      "startup on postgres/mongo/rabbitmq.")
h1 = svg.note(14, NY, 450, wrap(n1, 450 - 40))
h2 = svg.note(490, NY, 590, wrap(n2, 590 - 40))
h3 = svg.note(1106, NY, 480, wrap(n3, 480 - 40))
svg.anchor(300, NY, 300, DNS_Y + 130)
svg.anchor(640, NY, AX + AW, DNS_Y + 130)
svg.anchor(700, NY, AR, ROWS[2] + SVC_H - 30)
svg.anchor(1180, NY, CX + 70, M_Y + 190)
svg.anchor(1300, NY, BX + BW / 2, ROWS[3] + SVC_H)

# Internal calls, shown as one note instead of paths
IY = NY + max(h1, h2, h3) + 30
calls = [
    "Internal calls between services (paths not drawn):",
    "listing -> identity (REST), booking (gRPC), review (REST)",
    "booking -> identity, listing, payment, rental (REST)",
    "rental -> booking (gRPC), payment (REST);   review -> rental (REST)",
]
hi = svg.note(14, IY, 1572, calls)

svg.h = IY + hi + 24
open("fig-7-1-service-discovery.svg", "w").write(
    svg.render("Figure 7.1: Service discovery on Docker Compose (UML deployment diagram)"))
print("height", svg.h, [width(s) for s in ("GET /health :3007", "notification app")])
