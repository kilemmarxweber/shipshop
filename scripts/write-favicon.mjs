import fs from "node:fs";
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#ff5722"/>
  <text x="16" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="#ffffff">S</text>
</svg>`;

function rgbaToIco(rgba, size) {
  const xorSize = size * size * 4;
  const andRow = Math.ceil(size / 32) * 4;
  const andSize = andRow * size;
  const dib = Buffer.alloc(40 + xorSize + andSize);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  let o = 40;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      dib[o++] = rgba[i + 2];
      dib[o++] = rgba[i + 1];
      dib[o++] = rgba[i];
      dib[o++] = rgba[i + 3];
    }
  }
  const dir = Buffer.alloc(22);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(1, 4);
  dir[6] = size;
  dir[7] = size;
  dir.writeUInt16LE(1, 10);
  dir.writeUInt16LE(32, 12);
  dir.writeUInt32LE(dib.length, 14);
  dir.writeUInt32LE(22, 18);
  return Buffer.concat([dir, dib]);
}

const png32 = await sharp(Buffer.from(svg)).resize(32, 32).ensureAlpha().png().toBuffer();
const png192 = await sharp(Buffer.from(svg)).resize(192, 192).ensureAlpha().png().toBuffer();
const png180 = await sharp(Buffer.from(svg)).resize(180, 180).ensureAlpha().png().toBuffer();
const { data, info } = await sharp(png32).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
});
if (info.channels !== 4) throw new Error(`expected rgba, got ${info.channels}`);
const ico = rgbaToIco(data, 32);

fs.writeFileSync("public/icon-32.png", png32);
fs.writeFileSync("public/icon-192.png", png192);
fs.writeFileSync("public/apple-touch-icon.png", png180);
fs.writeFileSync("public/favicon.ico", ico);
fs.writeFileSync("src/app/icon.png", png32);
console.log("ok", { ico: ico.length, channels: info.channels });
