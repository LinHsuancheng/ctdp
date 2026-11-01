"""Generates the app and tray icons (a chain link ring) as PNGs.

Pure stdlib so it runs anywhere: python3 scripts/make-icons.py
"""
import math
import struct
import zlib
from pathlib import Path

ACCENT = (37, 99, 235)  # blue-600
OUT = Path(__file__).resolve().parent.parent / "resources"


def png(size: int, pixels) -> bytes:
    rows = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def ring(size: int):
    c = (size - 1) / 2
    outer, inner = size * 0.46, size * 0.26
    samples = 4  # supersampling for smooth edges
    for y in range(size):
        row = []
        for x in range(size):
            hit = 0
            for sy in range(samples):
                for sx in range(samples):
                    d = math.hypot(x + (sx + 0.5) / samples - 0.5 - c, y + (sy + 0.5) / samples - 0.5 - c)
                    hit += inner <= d <= outer
            row.append((*ACCENT, round(255 * hit / samples**2)))
        yield row


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name, size in (("icon.png", 256), ("tray.png", 32)):
        (OUT / name).write_bytes(png(size, list(ring(size))))
        print(f"wrote resources/{name} ({size}x{size})")


if __name__ == "__main__":
    main()
