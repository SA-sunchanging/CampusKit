"""Figure 6.1: API Gateway routes and interfaces (UML component diagram)."""

from uml import ACCENT, INK, Svg, width

W = 1600
svg = Svg(W, 1000)  # height fixed below

# Web App and the gateway's public interface
WX, WW = 60, 400
svg.component(WX, 40, WW, 130, "Web App")
jx, jy = WX + WW / 2, 262
svg.line(jx, 170, jx, jy - 25)
svg.socket(jx, jy, "down")
svg.ball(jx, jy)
GY = 350
svg.line(jx, jy + 15, jx, GY)
svg.text(jx - 40, jy - 10, "REST /api", anchor="end")
svg.text(jx + 40, jy + 30, "REST /api/*")

# Services, one row each
SX, SW, SH, PITCH = 1150, 390, 118, 160
services = [
    ("Identity", "/api/identity/", "REST"),
    ("Listing", "/api/listing/", "REST"),
    ("Rental", "/api/rental/", "REST"),
    ("Payment", "/api/payment/", "REST"),
    ("Review", "/api/review/", "REST"),
    ("Notification", "/api/notification/", "REST"),
    ("Booking", None, "BookingService (gRPC)"),
]
GX2 = WX + WW
BX = 870  # x of every ball-and-socket joint
for i, (name, prefix, provided) in enumerate(services):
    y = GY + i * PITCH
    cy = y + SH / 2
    color = INK if prefix else ACCENT
    svg.component(SX, y, SW, SH, name)
    svg.line(GX2, cy, BX - 25, cy, color=color)
    svg.socket(BX, cy, "right", color=color)
    svg.ball(BX, cy, color=color)
    svg.line(BX + 15, cy, SX, cy, color=color)
    if prefix:
        svg.text(GX2 + 24, cy - 14, prefix)
        svg.text(BX + 40, cy - 14, provided)
    else:
        svg.text(BX, cy - 38, provided, anchor="middle", color=ACCENT)

GH = (len(services) - 1) * PITCH + SH
svg.component(WX, GY, WW, GH, "API Gateway")

# Note on the gateway
NY = GY + GH + 70
lines = ["Rejects invalid JWT (401); forwards token and x-correlation-id;",
         "no business logic, no database; maps gRPC status -> HTTP."]
NW = 1000
nh = svg.note(WX, NY, NW, lines)
svg.anchor(WX + 200, NY, WX + 200, GY + GH)

svg.h = NY + nh + 40
open("fig-6-1-gateway-components.svg", "w").write(
    svg.render("Figure 6.1: API Gateway routes and interfaces (UML component diagram)"))
print("height", svg.h, "label widths", width("BookingService (gRPC)"), width("/api/notification/"))
