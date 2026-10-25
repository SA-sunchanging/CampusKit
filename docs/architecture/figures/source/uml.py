"""Small SVG helpers for strict UML 2.5 shapes. Output is ASCII only."""

from PIL import ImageFont

FONT_DIR = "/usr/share/fonts/truetype/liberation/"
FAMILY = "Arial, Helvetica, 'Liberation Sans', sans-serif"
INK = "#1a1a1a"
GREY = "#555555"
ACCENT = "#1f5fbf"
FS = 32  # minimum font size: 9 pt when 1600 px is shown at 16 cm

_fonts = {}


def _font(size, bold):
    key = (size, bold)
    if key not in _fonts:
        name = "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"
        _fonts[key] = ImageFont.truetype(FONT_DIR + name, size)
    return _fonts[key]


ENT = {"<<": "\u00ab", ">>": "\u00bb", "->": "\u2192"}


def plain(text):
    """Text as rendered (for measuring)."""
    for k, v in ENT.items():
        text = text.replace(k, v)
    return text


def esc(text):
    """Escape for SVG, writing non-ASCII as character references."""
    text = text.replace("&", "&amp;").replace("<<", "\u00ab").replace(">>", "\u00bb")
    text = text.replace("->", "\u2192").replace("<", "&lt;").replace(">", "&gt;")
    return "".join(c if ord(c) < 128 else "&#%d;" % ord(c) for c in text)


def width(text, size=FS, bold=False):
    return _font(size, bold).getlength(plain(text))


class Svg:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=FS, bold=False, anchor="start", color=INK, italic=False):
        assert size >= FS, s
        attrs = 'x="%g" y="%g" font-size="%d" text-anchor="%s" fill="%s"' % (
            x, y, size, anchor, color)
        if bold:
            attrs += ' font-weight="bold"'
        if italic:
            attrs += ' font-style="italic"'
        self.add("<text %s>%s</text>" % (attrs, esc(s)))

    def line(self, x1, y1, x2, y2, color=INK, w=2.5, dash=None):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        self.add('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g"%s/>'
                 % (x1, y1, x2, y2, color, w, d))

    def poly(self, pts, color=INK, w=2.5, dash=None, fill="none"):
        d = ' stroke-dasharray="%s"' % dash if dash else ""
        p = " ".join("%g,%g" % pt for pt in pts)
        self.add('<polyline points="%s" fill="%s" stroke="%s" stroke-width="%g" '
                 'stroke-linejoin="round"%s/>' % (p, fill, color, w, d))

    def rect(self, x, y, w, h, fill="#ffffff", stroke=INK, sw=2.5):
        self.add('<rect x="%g" y="%g" width="%g" height="%g" fill="%s" stroke="%s" '
                 'stroke-width="%g"/>' % (x, y, w, h, fill, stroke, sw))

    def path(self, d, stroke=INK, w=2.5, fill="none"):
        self.add('<path d="%s" fill="%s" stroke="%s" stroke-width="%g"/>' % (d, fill, stroke, w))

    def render(self, title):
        head = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
                'viewBox="0 0 %d %d" font-family="%s">\n<title>%s</title>\n'
                '<rect x="0" y="0" width="%d" height="%d" fill="#ffffff"/>\n'
                % (self.w, self.h, self.w, self.h, FAMILY, esc(title), self.w, self.h))
        body = "\n".join(self.parts)
        out = head + body + "\n</svg>\n"
        assert all(ord(c) < 128 for c in out)
        return out

    # --- UML shapes ---------------------------------------------------------

    def component_icon(self, x, y, color=INK):
        """UML component icon; (x, y) is its top-left corner."""
        self.rect(x + 7, y, 26, 32, stroke=color, sw=2)
        self.rect(x, y + 6, 14, 7, stroke=color, sw=2)
        self.rect(x, y + 19, 14, 7, stroke=color, sw=2)

    def component(self, x, y, w, h, name, stereo="<<component>>"):
        self.rect(x, y, w, h)
        self.component_icon(x + w - 48, y + 12)
        cx = x + w / 2
        top = y + (h - 76) / 2
        self.text(cx, top + 30, stereo, anchor="middle")
        self.text(cx, top + 70, name, size=34, bold=True, anchor="middle")

    def node(self, x, y, w, h, depth=16, sw=2.5):
        """UML node (3D box); (x, y, w, h) is the front face."""
        d = depth
        self.add('<path d="M%g %g L%g %g L%g %g L%g %g Z" fill="#ffffff" stroke="%s" '
                 'stroke-width="%g" stroke-linejoin="round"/>'
                 % (x, y, x + d, y - d, x + w + d, y - d, x + w, y, INK, sw))
        self.add('<path d="M%g %g L%g %g L%g %g L%g %g Z" fill="#ffffff" stroke="%s" '
                 'stroke-width="%g" stroke-linejoin="round"/>'
                 % (x + w, y, x + w + d, y - d, x + w + d, y + h - d, x + w, y + h, INK, sw))
        self.rect(x, y, w, h, sw=sw)

    def artifact_icon(self, x, y):
        """UML artifact icon (document with folded corner); (x, y) top-left."""
        self.path("M%g %g L%g %g L%g %g L%g %g L%g %g Z M%g %g L%g %g L%g %g"
                  % (x, y, x + 16, y, x + 24, y + 8, x + 24, y + 30, x, y + 30,
                     x + 16, y, x + 16, y + 8, x + 24, y + 8), w=2)

    def note(self, x, y, w, lines, fold=22, pad=18, lh=40, color=INK):
        h = pad * 2 + lh * len(lines) - (lh - FS) + 4
        self.add('<path d="M%g %g L%g %g L%g %g L%g %g L%g %g Z M%g %g L%g %g L%g %g" '
                 'fill="#ffffff" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
                 % (x, y, x + w - fold, y, x + w, y + fold, x + w, y + h, x, y + h,
                    x + w - fold, y, x + w - fold, y + fold, x + w, y + fold, GREY))
        for i, ln in enumerate(lines):
            self.text(x + pad, y + pad + FS - 4 + i * lh, ln, color=color)
        return h

    def anchor(self, x1, y1, x2, y2):
        """Note attachment: dashed line without arrowhead."""
        self.line(x1, y1, x2, y2, color=GREY, w=2, dash="8 6")

    def ball(self, cx, cy, r=15, color=INK):
        self.add('<circle cx="%g" cy="%g" r="%g" fill="#ffffff" stroke="%s" stroke-width="2.5"/>'
                 % (cx, cy, r, color))

    def socket(self, cx, cy, opens, r=25, color=INK):
        """Half circle around (cx, cy) that opens towards 'right' or 'down'."""
        if opens == "right":
            d = "M%g %g A%g %g 0 0 0 %g %g" % (cx, cy - r, r, r, cx, cy + r)
        else:
            d = "M%g %g A%g %g 0 0 1 %g %g" % (cx - r, cy, r, r, cx + r, cy)
        self.path(d, stroke=color)

    def arrow(self, pts, color=INK, size=20):
        """Polyline with an open arrowhead (navigability) at its last point."""
        import math
        self.poly(pts, color=color)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        a = math.atan2(y2 - y1, x2 - x1)
        for s in (-1, 1):
            b = a + math.pi - s * math.radians(28)
            self.line(x2, y2, x2 + size * math.cos(b), y2 + size * math.sin(b), color=color)

    def port(self, cx, cy, s=20):
        self.rect(cx - s / 2, cy - s / 2, s, s, sw=2.5)


def wrap(text, maxw, size=FS):
    words, lines, cur = text.split(" "), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if width(trial, size) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    lines.append(cur)
    return lines
