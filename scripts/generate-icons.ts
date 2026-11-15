/**
 * Renders the extension icon (a figure in a pushup on a teal tile) to PNG
 * files in public/icon/. The output is committed; rerun after changing
 * the drawing:
 *
 *   node scripts/generate-icons.ts
 *
 * Shapes are signed distance functions on a 128 x 128 canvas, supersampled
 * 4 x 4 per pixel for anti-aliasing. No dependencies beyond node:zlib.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type Vec = readonly [number, number];
type Rgba = readonly [number, number, number, number];

const background: Rgba = [15, 118, 110, 255]; // teal-700
const backgroundDark: Rgba = [17, 94, 89, 255]; // teal-800
const figure: Rgba = [255, 255, 255, 255];
const floor: Rgba = [153, 246, 228, 255]; // teal-200

const roundedSquare = ([x, y]: Vec, half: number, radius: number): number => {
  const qx = Math.abs(x - 64) - (half - radius);
  const qy = Math.abs(y - 64) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
};

const capsule = ([px, py]: Vec, [ax, ay]: Vec, [bx, by]: Vec, radius: number): number => {
  const [pax, pay] = [px - ax, py - ay];
  const [bax, bay] = [bx - ax, by - ay];
  const h = Math.min(Math.max((pax * bax + pay * bay) / (bax * bax + bay * bay), 0), 1);
  return Math.hypot(pax - bax * h, pay - bay * h) - radius;
};

const circle = ([px, py]: Vec, [cx, cy]: Vec, radius: number): number =>
  Math.hypot(px - cx, py - cy) - radius;

const shoulder: Vec = [46, 66];
const feet: Vec = [104, 96];
const hand: Vec = [47, 97];
const head: Vec = [32, 59];

/** Colour of one sample point, or null when it lies outside the tile. */
const shade = (p: Vec): Rgba | null => {
  if (roundedSquare(p, 62, 26) > 0) return null;
  if (circle(p, head, 9.5) <= 0) return figure;
  if (capsule(p, shoulder, feet, 6) <= 0) return figure;
  if (capsule(p, shoulder, hand, 5) <= 0) return figure;
  if (capsule(p, [18, 103], [110, 103], 2.5) <= 0) return floor;
  const t = p[1] / 128;
  return [
    background[0] + (backgroundDark[0] - background[0]) * t,
    background[1] + (backgroundDark[1] - background[1]) * t,
    background[2] + (backgroundDark[2] - background[2]) * t,
    255,
  ];
};

const render = (size: number): Buffer => {
  const samples = 4;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0, then RGBA
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const p: Vec = [
            ((x + (sx + 0.5) / samples) * 128) / size,
            ((y + (sy + 0.5) / samples) * 128) / size,
          ];
          const c = shade(p);
          if (c === null) continue;
          acc[0]! += c[0] * c[3];
          acc[1]! += c[1] * c[3];
          acc[2]! += c[2] * c[3];
          acc[3]! += c[3];
        }
      }
      const alpha = acc[3]!;
      const offset = 1 + x * 4;
      if (alpha > 0) {
        row[offset] = Math.round(acc[0]! / alpha);
        row[offset + 1] = Math.round(acc[1]! / alpha);
        row[offset + 2] = Math.round(acc[2]! / alpha);
        row[offset + 3] = Math.round(alpha / (samples * samples));
      }
    }
    rows.push(row);
  }
  return encodePng(size, Buffer.concat(rows));
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (data: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const encodePng = (size: number, raw: Buffer): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

for (const size of [16, 32, 48, 128]) {
  const path = new URL(`../public/icon/${size}.png`, import.meta.url);
  writeFileSync(path, render(size));
  console.log(`wrote ${path.pathname}`);
}
