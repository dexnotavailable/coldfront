"""Generate the schematic SVG diagrams in this folder: world layout (top view) and funnel (side view).

Run: python3 docs/diagrams/make_diagrams.py   (no dependencies). Update the names here when display names change."""
import math

import os
OUT = os.path.dirname(os.path.abspath(__file__))

FONT = "font-family='Inter, Helvetica, Arial, sans-serif'"

# ---------------------------------------------------------------- world layout (top view)
def world_layout():
    W = H = 1000
    cx = cy = 500
    km = 21.0  # px per km  (21.5 km -> 451 px)

    def pt(bearing_deg, r_km):
        a = math.radians(bearing_deg)
        return cx + math.sin(a) * r_km * km, cy - math.cos(a) * r_km * km

    def sector(b0, b1, r0, r1, fill, stroke="#0e1116", sw=1.5):
        steps = max(8, int(abs(b1 - b0) / 2))
        outer = [pt(b0 + (b1 - b0) * i / steps, r1) for i in range(steps + 1)]
        inner = [pt(b1 - (b1 - b0) * i / steps, r0) for i in range(steps + 1)]
        d = "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in outer + inner) + " Z"
        return f"<path d='{d}' fill='{fill}' stroke='{stroke}' stroke-width='{sw}'/>"

    def label(bearing, r, text, color, size=15, weight=600, sub=None, subcolor=None):
        x, y = pt(bearing, r)
        s = f"<text x='{x:.1f}' y='{y:.1f}' text-anchor='middle' {FONT} font-size='{size}' font-weight='{weight}' fill='{color}'>{text}</text>"
        if sub:
            s += f"<text x='{x:.1f}' y='{y + size + 2:.1f}' text-anchor='middle' {FONT} font-size='{size - 4}' fill='{subcolor or color}' opacity='0.85'>{sub}</text>"
        return s

    outer = [  # bearing centre, name, subtitle, fill, text colour
        (0, "Shirogane", "tundra · silver", "#dce6ec", "#1d2833"),
        (45, "Kurogane", "mountains · iron, coal", "#8b9099", "#101418"),
        (90, "Kogane", "desert · gold", "#d4b066", "#2a1f08"),
        (135, "The Boneyard", "titan bone", "#c4bfb2", "#23211c"),
        (180, "The Selva", "jungle · ironwood", "#4c7a3a", "#eef5e8"),
        (225, "The Sallows", "swamp · peat", "#6e7848", "#f1f3e6"),
        (270, "The Grey Mere", "great lake · salt, fish", "#7b95a6", "#0f1a22"),
        (315, "The Hearthlands", "plains · grain, horses", "#a2b86b", "#18200c"),
    ]
    inner = [
        (45, "Hoshikuzu", "shardfields · mana crystal", "#3f8f98", "#eafcff"),
        (135, "Ibara", "hellscape · brimstone", "#6e2a1c", "#ffe3d6"),
        (225, "The Sundered Isles", "floating land · skystone", "#9fb0c3", "#131b24"),
        (315, "Tasogare", "twilight · moonsilver", "#463a74", "#ece6ff"),
    ]

    parts = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H + 60}' width='{W}' height='{H + 60}'>",
             "<defs><radialGradient id='frost' cx='50%' cy='50%' r='55%'><stop offset='80%' stop-color='#eef3f7'/><stop offset='100%' stop-color='#ffffff'/></radialGradient></defs>",
             f"<rect width='{W}' height='{H + 60}' fill='#f4f6f8'/>",
             f"<circle cx='{cx}' cy='{cy}' r='{21.5 * km + 30}' fill='url(#frost)'/>",
             f"<circle cx='{cx}' cy='{cy}' r='{21.5 * km}' fill='#c9dbe6' stroke='#9fb6c6' stroke-width='1.5'/>"]
    for b, name, sub, fill, tc in outer:
        parts.append(sector(b - 22.5, b + 22.5, 12.9, 20.5, fill))
    for b, name, sub, fill, tc in inner:
        parts.append(sector(b - 45, b + 45, 6.2, 12.9, fill))
    parts.append(f"<circle cx='{cx}' cy='{cy}' r='{6.2 * km}' fill='#1b2733' stroke='#0e1116' stroke-width='1.5'/>")
    parts.append(f"<circle cx='{cx}' cy='{cy}' r='{5.0 * km}' fill='#2a2a31' stroke='#0e1116' stroke-width='1.5'/>")
    # land bridges across the Blackwater
    for b in (20, 140, 255):
        x0, y0 = pt(b, 4.9)
        x1, y1 = pt(b, 6.3)
        parts.append(f"<line x1='{x0:.1f}' y1='{y0:.1f}' x2='{x1:.1f}' y2='{y1:.1f}' stroke='#5b5f68' stroke-width='5' stroke-linecap='round'/>")
    # spawn line
    parts.append(f"<circle cx='{cx}' cy='{cy}' r='{16 * km}' fill='none' stroke='#0e1116' stroke-width='1.2' stroke-dasharray='6 6' opacity='0.55'/>")
    # labels
    for b, name, sub, fill, tc in outer:
        parts.append(label(b, 17.7, name, tc, 16, 700, sub))
    for b, name, sub, fill, tc in inner:
        parts.append(label(b, 9.4, name, tc, 15, 700, sub))
    parts.append(label(0, 5.45, "THE BLACKWATER", "#9fb3c8", 10, 700))
    parts.append(f"<text x='{cx}' y='{cy - 18}' text-anchor='middle' {FONT} font-size='15' font-weight='700' fill='#e7e9ee'>The Nadir</text>")
    parts.append(f"<text x='{cx}' y='{cy}' text-anchor='middle' {FONT} font-size='11' fill='#b9bec8'>demon king's continent</text>")
    # keep marker
    parts.append(f"<rect x='{cx - 7}' y='{cy + 10}' width='14' height='14' fill='#0b0b0e' stroke='#c9a24a' stroke-width='2' transform='rotate(45 {cx} {cy + 17})'/>")
    parts.append(f"<text x='{cx}' y='{cy + 46}' text-anchor='middle' {FONT} font-size='11' fill='#e2c77e'>Nadir Keep · the Stair</text>")
    # rim label
    x, y = pt(0, 21.0)
    parts.append(f"<text x='{x:.1f}' y='{y + 4:.1f}' text-anchor='middle' {FONT} font-size='10' font-weight='700' fill='#4a6272' letter-spacing='2'>THE RIM</text>")
    x, y = pt(180, 21.0)
    parts.append(f"<text x='{x:.1f}' y='{y + 4:.1f}' text-anchor='middle' {FONT} font-size='10' font-weight='700' fill='#4a6272' letter-spacing='2'>THE RIM</text>")
    # spawn line label
    # compass
    parts.append(f"<g transform='translate(70 80)'><path d='M 0 -26 L 8 6 L 0 0 L -8 6 Z' fill='#0e1116'/><text x='0' y='24' text-anchor='middle' {FONT} font-size='14' font-weight='700' fill='#0e1116'>N</text></g>")
    # scale bar 5 km
    sx, sy = 70, H - 10
    parts.append(f"<g><line x1='{sx}' y1='{sy}' x2='{sx + 5 * km}' y2='{sy}' stroke='#0e1116' stroke-width='3'/><line x1='{sx}' y1='{sy - 6}' x2='{sx}' y2='{sy + 6}' stroke='#0e1116' stroke-width='2'/><line x1='{sx + 5 * km}' y1='{sy - 6}' x2='{sx + 5 * km}' y2='{sy + 6}' stroke='#0e1116' stroke-width='2'/><text x='{sx + 2.5 * km}' y='{sy - 10}' text-anchor='middle' {FONT} font-size='12' fill='#0e1116'>5 km</text></g>")
    # title & legend
    parts.append(f"<text x='{W - 30}' y='40' text-anchor='end' {FONT} font-size='20' font-weight='700' fill='#0e1116'>Kaldmark · surface layout</text>")
    parts.append(f"<text x='{W - 30}' y='62' text-anchor='end' {FONT} font-size='12' fill='#4b5563'>Schematic. Real borders are warped and blend over 150–800 m.</text>")
    parts.append(f"<text x='{W - 30}' y='{H + 20}' text-anchor='end' {FONT} font-size='12' fill='#4b5563'>Outer ring 12.9–20.5 km (Tier I) · Inner ring 6.2–12.9 km (Tier II) · Blackwater 5.0–6.2 km · Nadir 0–5.0 km (Tier III)</text>")
    parts.append(f"<text x='{W - 30}' y='{H + 40}' text-anchor='end' {FONT} font-size='12' fill='#4b5563'>Each region ≈ 100 km². Dashed line: kings spawn outside it (r ≥ 16 km). Grey bars: ruined land bridges.</text>")
    parts.append("</svg>")
    with open(f"{OUT}/world-layout.svg", "w") as f:
        f.write("\n".join(parts))


# ---------------------------------------------------------------- funnel (side view)
def funnel():
    W, H = 1240, 760
    left, right, top, bottom = 90, W - 40, 90, H - 110
    xr = (-22.5, 22.5)  # km, SW negative, NE positive
    yr = (-1536, 1024)  # metres

    def X(km_):
        return left + (km_ - xr[0]) / (xr[1] - xr[0]) * (right - left)

    def Y(m):
        return top + (yr[1] - m) / (yr[1] - yr[0]) * (bottom - top)

    p = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' width='{W}' height='{H}'>",
         f"<rect width='{W}' height='{H}' fill='#f4f6f8'/>",
         # deeprock background
         f"<rect x='{X(-21.5)}' y='{Y(0)}' width='{X(21.5) - X(-21.5)}' height='{Y(-1504) - Y(0)}' fill='#3a3f47'/>",
         f"<rect x='{X(-21.5)}' y='{Y(-1504)}' width='{X(21.5) - X(-21.5)}' height='{Y(-1536) - Y(-1504)}' fill='#111317'/>",
         ]
    # layers (open funnel footprints), both sides
    bands = [
        ("Layer 1 · the Upper Deep", -48, -368, 6.5, 16.5, "#7d8793"),
        ("Layer 2 · the Undercrown", -400, -720, 3.5, 11.5, "#6b7482"),
        ("Layer 3 · the Maw", -752, -1072, 2.0, 7.0, "#6a5f68"),
    ]
    for name, y0, y1, rin, rout, col in bands:
        for sgn in (-1, 1):
            a, b = sorted((sgn * rin, sgn * rout))
            p.append(f"<rect x='{X(a):.1f}' y='{Y(y0):.1f}' width='{X(b) - X(a):.1f}' height='{Y(y1) - Y(y0):.1f}' fill='{col}' rx='6'/>")
    # Pit
    p.append(f"<rect x='{X(-2.2):.1f}' y='{Y(-1104):.1f}' width='{X(2.2) - X(-2.2):.1f}' height='{Y(-1504) - Y(-1104):.1f}' fill='#5a3b3b' rx='10'/>")
    p.append(f"<circle cx='{X(0):.1f}' cy='{Y(-1420):.1f}' r='16' fill='#ffd98a' opacity='0.9'/><circle cx='{X(0):.1f}' cy='{Y(-1420):.1f}' r='30' fill='#ffd98a' opacity='0.25'/>")
    # Hollow Sky highlight (SW, L2) and the Sundering
    p.append(f"<rect x='{X(-10.8):.1f}' y='{Y(-400):.1f}' width='{X(-5.2) - X(-10.8):.1f}' height='{Y(-720) - Y(-400):.1f}' fill='#8ea3b8' rx='6'/>")
    # surface profile polyline (SW -> NE)
    prof = [(-22.5, 620), (-21.5, 640), (-20.8, 420), (-20.0, 60), (-18.5, 12), (-15, 4), (-13, 8),  # Rim, Sallows
            (-12.9, 20), (-11.5, 30), (-10.6, 25), (-10.4, -400), (-6.9, -400), (-6.7, 30), (-6.2, 40),  # Sundered Isles w/ Sundering
            (-6.1, 0), (-6.0, -200), (-5.2, -210), (-5.1, 0), (-5.0, 160), (-3.0, 200), (-1.2, 240), (-0.5, 320),  # Blackwater, Nadir
            (0.5, 320), (1.2, 240), (3.0, 210), (5.0, 170), (5.1, 0), (5.2, -220), (6.0, -210), (6.1, 0), (6.2, 60),
            (9.0, 80), (12.0, 90), (12.9, 120), (14.0, 380), (15.0, 820), (15.8, 520), (16.6, 880), (17.5, 460), (18.5, 700), (19.5, 300), (20.5, 120), (21.0, 420), (21.5, 640), (22.5, 620)]
    land = [(X(k), Y(m)) for k, m in prof]
    poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in land)
    # fill land from profile down to y=0 line / crust (grey-brown)
    p.append(f"<polygon points='{poly} {X(22.5):.1f},{Y(-48):.1f} {X(-22.5):.1f},{Y(-48):.1f}' fill='#8b7f6e'/>")
    # blackwater water
    for a, b in ((-6.1, -5.1), (5.1, 6.1)):
        p.append(f"<rect x='{X(a):.1f}' y='{Y(0):.1f}' width='{X(b) - X(a):.1f}' height='{Y(-205) - Y(0):.1f}' fill='#1d2b38'/>")
    # re-cut the Sundering (drawn as sky-coloured gap) and its opening into the Hollow Sky
    p.append(f"<rect x='{X(-10.4):.1f}' y='{Y(40):.1f}' width='{X(-6.9) - X(-10.4):.1f}' height='{Y(-402) - Y(40):.1f}' fill='#c7d3de'/>")
    # floating isles
    for k, m, w in ((-10.0, 520, 0.9), (-8.8, 300, 0.6), (-7.9, 760, 1.1), (-7.2, 180, 0.5), (-9.4, 880, 0.5)):
        x0, x1 = X(k - w / 2), X(k + w / 2)
        p.append(f"<path d='M {x0:.1f} {Y(m):.1f} L {x1:.1f} {Y(m):.1f} L {X(k):.1f} {Y(m - 160 * w):.1f} Z' fill='#8e9aa6'/><rect x='{x0:.1f}' y='{Y(m) - 3:.1f}' width='{x1 - x0:.1f}' height='4' fill='#6f8d58'/>")
    # Nadir Stair shaft
    p.append(f"<rect x='{X(-0.14):.1f}' y='{Y(320):.1f}' width='{X(0.14) - X(-0.14):.1f}' height='{Y(-1200) - Y(320):.1f}' fill='#1a1014' stroke='#c9a24a' stroke-width='1.5'/>")
    # keep
    kx, ky = X(0), Y(320)
    p.append(f"<path d='M {kx - 16} {ky} L {kx - 16} {ky - 26} L {kx - 8} {ky - 26} L {kx - 8} {ky - 40} L {kx} {ky - 52} L {kx + 8} {ky - 40} L {kx + 8} {ky - 26} L {kx + 16} {ky - 26} L {kx + 16} {ky} Z' fill='#0b0b0e' stroke='#c9a24a' stroke-width='1.5'/>")
    # Delvers' Road: a helix ramp where the Old Workings lie over the Buried City (drawn as a zigzag)
    zz = []
    y = -215
    left_side = True
    while y > -560:
        zz.append((10.0 if left_side else 10.6, y))
        y -= 40
        left_side = not left_side
    d = "M " + " L ".join(f"{X(k):.1f} {Y(m):.1f}" for k, m in zz)
    p.append(f"<path d='{d}' fill='none' stroke='#ffe6a6' stroke-width='2' stroke-dasharray='4 3'/>")
    # shelves labels & band labels on left
    def ylabel(m, text, bold=False):
        fw = "font-weight='700'" if bold else ""
        return f"<text x='{left - 8}' y='{Y(m) + 4:.1f}' text-anchor='end' {FONT} font-size='11' {fw} fill='#374151'>{text}</text>"
    for m in (1024, 800, 320, 0, -400, -752, -1104, -1504):
        p.append(ylabel(m, f"{m:+,}".replace('+0', '0')))
        p.append(f"<line x1='{left - 4}' y1='{Y(m):.1f}' x2='{left}' y2='{Y(m):.1f}' stroke='#374151'/>")
    # region labels
    def t(x, y, text, color="#f3f4f6", size=12, weight=600, anchor="middle"):
        return f"<text x='{x:.1f}' y='{y:.1f}' text-anchor='{anchor}' {FONT} font-size='{size}' font-weight='{weight}' fill='{color}'>{text}</text>"
    p.append(t(X(0), Y(-1250), "NARAKU (the Pit) · the Throne", "#ffe9c2", 12, 700))
    p.append(t(X(1.0), Y(-1424), "the Wellspring", "#ffe9c2", 10, 700, "start"))
    caps = [("Layer 1 · the Upper Deep", -48, -368, -19.4), ("Layer 2 · the Undercrown", -400, -720, -16.3), ("Layer 3 · the Maw", -752, -1072, -12.0)]
    for name, y0, y1, xc in caps:
        yc = (Y(y0) + Y(y1)) / 2
        if "Upper Deep" in name:
            xc = -19.0
            p.append(t(X(xc), yc - 10, "Layer 1", "#e5e7eb", 12, 700))
            p.append(t(X(xc), yc + 4, "the Upper Deep", "#e5e7eb", 12, 700))
            p.append(t(X(xc), yc + 18, f"y {y0:,} to {y1:,}", "#9ca3af", 10, 400))
            continue
        p.append(t(X(xc), yc - 2, name, "#e5e7eb", 12, 700))
        p.append(t(X(xc), yc + 14, f"y {y0:,} to {y1:,}", "#9ca3af", 10, 400))
    p.append(t(X(-8.0), Y(-600), "the Hollow Sky", "#0f1720", 12, 700))
    p.append(t(X(6.6), Y(-640), "Buried City", "#ffe6a6", 11, 700))
    p.append(t(X(14.6), Y(-150), "Old Workings", "#ffe6a6", 11, 700))
    p.append(t(X(9.0), Y(-150), "Kagami Grottos", "#f8fafc", 11, 600))
    p.append(t(X(11.0), Y(-470), "Delvers' Road", "#ffe6a6", 10, 600, "start"))
    p.append(t(X(-13.8), Y(-210), "Sporewood", "#f8fafc", 11, 600))
    p.append(t(X(-4.5), Y(-920), "Yomi (Ash Sea)", "#f8fafc", 11, 600))
    p.append(t(X(4.5), Y(-920), "Deep Forges", "#f8fafc", 11, 600))
    p.append(t(X(-8.6), Y(100), "the Sundering", "#1f2937", 11, 700))
    p.append(t(X(-8.6), Y(960), "Sundered Isles", "#1f2937", 12, 700))
    p.append(t(X(-16.0), Y(120), "Sallows", "#1f2937", 12, 700))
    p.append(t(X(16.5), Y(960), "Kurogane", "#1f2937", 12, 700))
    p.append(t(X(9.5), Y(200), "Hoshikuzu", "#1f2937", 12, 700))
    p.append(t(X(0), Y(620), "Nadir Keep", "#1f2937", 12, 700))
    p.append(t(X(0.9), Y(-300), "the Nadir Stair", "#e2c77e", 10, 700, "start"))
    p.append(t(X(-5.6), Y(-260), "Blackwater", "#cbd5e1", 10, 600))
    p.append(t(X(5.6), Y(-260), "Blackwater", "#cbd5e1", 10, 600))
    p.append(t(X(-18.5), Y(-900), "deeprock", "#9ca3af", 12, 600))
    p.append(t(X(18.5), Y(-900), "deeprock", "#9ca3af", 12, 600))
    p.append(t(X(-21.9), Y(760), "Rim", "#1f2937", 11, 700))
    p.append(t(X(21.9), Y(760), "Rim", "#1f2937", 11, 700))
    # axis
    p.append(f"<line x1='{X(-21.5):.1f}' y1='{bottom + 30}' x2='{X(21.5):.1f}' y2='{bottom + 30}' stroke='#374151'/>")
    for k in range(-20, 21, 5):
        p.append(f"<line x1='{X(k):.1f}' y1='{bottom + 26}' x2='{X(k):.1f}' y2='{bottom + 34}' stroke='#374151'/>")
        p.append(t(X(k), bottom + 50, f"{abs(k)} km", "#374151", 11, 400))
    p.append(t(X(-21.5), bottom + 72, "← SW (bearing 225°)", "#374151", 12, 700, "start"))
    p.append(t(X(21.5), bottom + 72, "NE (bearing 45°) →", "#374151", 12, 700, "end"))
    p.append(t(W / 2, 36, "Kaldmark · the funnel (side view through the centre, SW–NE)", "#0e1116", 20, 700))
    p.append(t(W / 2, 60, "Schematic, vertical exaggeration ≈ 8×. Each layer's open footprint shrinks toward the Pit; outside it is deeprock.", "#4b5563", 12, 400))
    p.append("</svg>")
    with open(f"{OUT}/funnel.svg", "w") as f:
        f.write("\n".join(p))


world_layout()
funnel()
print("ok")
