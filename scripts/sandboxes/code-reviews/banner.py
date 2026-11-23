"""Paints the code-review sandbox's banner: a 960x600 PNG landscape, a sky at dusk, a sun and layered hills.

Usage: python3 banner.py <variant 0|1|2> <output.png>. Each variant moves the sun and recolors the near hills (green,
orange, purple), so the review's image diff has something to compare and its comments something to point at. Edges are
softened by their distance to the curve, so the picture stays smooth when the image diff zooms in.
"""
import math
import struct
import sys
import zlib

WIDTH, HEIGHT = 960, 600
SUN_X = [300, 480, 630]
NEAR_HILLS = [(58, 138, 82), (214, 122, 52), (112, 64, 158)]


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def sky(y):
    """From a deep blue at the top to a warm haze at the horizon."""
    t = min(1.0, y / (HEIGHT * 0.75))
    return mix((46, 92, 196), (250, 196, 150), t * t)


def far_ridge(x):
    return HEIGHT * 0.58 - 46 * math.sin(x / 140) - 22 * math.sin(x / 57 + 1.3)


def near_ridge(x):
    return HEIGHT * 0.72 - 70 * math.sin(x / 230 + 0.6) - 16 * math.sin(x / 75)


def over(base, color, coverage):
    return mix(base, color, max(0.0, min(1.0, coverage)))


def pixel(x, y, variant):
    sun_x, sun_y = SUN_X[variant], 190
    color = sky(y)
    distance = math.hypot(x - sun_x, y - sun_y)
    color = over(color, (255, 236, 170), 0.55 * math.exp(-max(0.0, distance - 60) / 70))
    color = over(color, (255, 214, 92), 60.5 - distance)
    color = over(color, mix((120, 120, 190), sky(y), 0.35), y - far_ridge(x) + 0.5)
    shade = 0.85 + 0.15 * (y - near_ridge(x)) / HEIGHT
    color = over(color, tuple(c * shade for c in NEAR_HILLS[variant]), y - near_ridge(x) + 0.5)
    return bytes(int(max(0, min(255, round(c)))) for c in color)


def png(variant):
    rows = b''.join(b'\0' + b''.join(pixel(x, y, variant) for x in range(WIDTH)) for y in range(HEIGHT))
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    header = struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    with open(sys.argv[2], 'wb') as out:
        out.write(png(int(sys.argv[1])))
