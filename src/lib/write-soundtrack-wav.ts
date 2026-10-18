import { mkdir, writeFile } from "fs/promises";
import path from "path";

function pcmWav(seconds: number, freq: number, sampleRate = 22050) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4);
    const sample =
      0.28 * Math.sin(2 * Math.PI * freq * t) +
      0.12 * Math.sin(2 * Math.PI * (freq * 1.5) * t) +
      0.08 * Math.sin(2 * Math.PI * (freq * 2) * t);
    const v = Math.max(-1, Math.min(1, sample * env));
    data.writeInt16LE(Math.round(v * 28000), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export async function writeSeedSoundtracks() {
  const dir = path.join(process.cwd(), "public", "soundtracks");
  await mkdir(dir, { recursive: true });
  const files = [
    { name: "actualites.wav", freq: 196, seconds: 14 },
    { name: "marche.wav", freq: 247, seconds: 14 },
    { name: "doux.wav", freq: 165, seconds: 14 },
  ];
  for (const file of files) {
    await writeFile(path.join(dir, file.name), pcmWav(file.seconds, file.freq));
  }
  return files.map((f) => ({
    file: f.name,
    url: `/soundtracks/${f.name}`,
    durationMs: f.seconds * 1000,
  }));
}
