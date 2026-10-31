"""Draw the fork's original Lite watch icons; no Apple font or SF Symbols assets.

PNG outputs are checked in, so Pillow is needed only when editing the artwork.
Run with a Python environment containing Pillow: python draw-icons.py
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[2] / 'frontend/harmony/watch/entry/src/main/js/default/common/icons'
OUTPUT.mkdir(parents=True, exist_ok=True)
SCALE = 4


def draw(name, glyph, button=False, edge=False, color='#aaaaaa'):
    width, height = (104, 64) if edge else (128, 128) if button else (64, 64)
    image = Image.new('RGBA', (width * SCALE, height * SCALE))
    d = ImageDraw.Draw(image)
    unit = min(width, height) / 64
    ox, oy = (width - 64 * unit) / 2, (height - 64 * unit) / 2

    def pts(values):
        return [((ox + x * unit) * SCALE, (oy + y * unit) * SCALE) for x, y in values]

    def line(values, fill=color, stroke=5):
        p = pts(values)
        r = stroke * unit * SCALE / 2
        d.line(p, fill=fill, width=round(r * 2), joint='curve')
        for x, y in p:
            d.ellipse((x-r, y-r, x+r, y+r), fill=fill)

    def polygon(values, fill=color):
        d.polygon(pts(values), fill=fill)

    if button:
        d.ellipse((0, 0, width*SCALE-1, height*SCALE-1), fill='#30d158')
        color = '#000000'
    if edge:
        d.rounded_rectangle((0, 0, width*SCALE-1, height*SCALE-1), radius=32*SCALE, fill='#262626')
        color = '#ffffff'
    if glyph == 'check':
        line([(19, 32), (28, 41), (46, 23)], color)
    elif glyph == 'play':
        polygon([(25, 17), (47, 32), (25, 47)], color)
    elif glyph == 'close':
        line([(23, 23), (41, 41)], color, 4)
        line([(41, 23), (23, 41)], color, 4)
    elif glyph == 'stop':
        polygon([(22, 22), (42, 22), (42, 42), (22, 42)], color)
    elif glyph in ('plus', 'minus'):
        line([(21, 32), (43, 32)], color, 4)
        if glyph == 'plus':
            line([(32, 21), (32, 43)], color, 4)
    elif glyph == 'back':
        line([(39, 16), (23, 32), (39, 48)], color, 5)
    elif glyph == 'retry':
        arc = [(32+19*math.cos(a/180*math.pi), 32+19*math.sin(a/180*math.pi)) for a in range(-40, 251, 3)]
        line(arc, color, 4)
        polygon([(17, 42), (29, 46), (19, 54)], color)
    elif glyph == 'heart':
        points = []
        for i in range(160):
            t = i / 160 * 2 * math.pi
            points.append((32 + 1.5*16*math.sin(t)**3, 30-1.5*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))))
        polygon(points, '#ff453a')
    elif glyph == 'offline':
        p = pts([(20, 10), (44, 54)])
        d.rounded_rectangle((p[0][0], p[0][1], p[1][0], p[1][1]), radius=5*SCALE, outline=color, width=3*SCALE)
        line([(29, 47), (35, 47)], color, 2)
        line([(10, 12), (54, 56)], '#000000', 10)
        line([(10, 12), (54, 56)], color, 4)
    elif glyph == 'flag':
        line([(20, 17), (20, 49)], color, 3)
        for row in range(3):
            for col in range(4):
                if (row + col) % 2 == 0:
                    x, y = 22+col*6, 17+row*6
                    polygon([(x,y), (x+6,y), (x+6,y+6), (x,y+6)], color)
    else:
        raise ValueError(glyph)
    image.resize((width, height), Image.Resampling.LANCZOS).save(OUTPUT / (name + '.png'), optimize=True)


for symbol in ('play', 'check', 'flag'):
    draw('button-' + symbol, symbol, button=True)
for symbol in ('close', 'stop', 'minus', 'plus'):
    draw('button-' + symbol, symbol, edge=True)
for symbol in ('back', 'retry', 'check', 'heart', 'offline'):
    draw(symbol, symbol)
