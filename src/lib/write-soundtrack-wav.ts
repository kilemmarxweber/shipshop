import { mkdir, writeFile } from "fs/promises";
import path from "path";

type TrackSpec = {
  name: string;
  seconds: number;
  tempoBpm: number;
  style: "news" | "street" | "lofi";
  progression: number[][];
  leadPattern: Array<number | null>;
};

function midiToFreq(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function frac(v: number) {
  return v - Math.floor(v);
}

function noise(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return frac(x) * 2 - 1;
}

function envAD(phase: number, attack: number, decay: number) {
  if (phase < 0) return 0;
  if (phase < attack) return phase / attack;
  if (phase < attack + decay) return 1 - (phase - attack) / decay;
  return 0;
}

function softClip(x: number) {
  return Math.tanh(x * 1.2);
}

function kick(time: number, beatStart: number) {
  const p = time - beatStart;
  if (p < 0 || p > 0.22) return 0;
  const env = Math.exp(-18 * p);
  const f = 72 - 36 * p;
  return Math.sin(2 * Math.PI * f * p) * env * 0.55;
}

function clap(time: number, beatStart: number, accent = 1) {
  const p = time - beatStart;
  if (p < 0 || p > 0.1) return 0;
  const env = Math.exp(-45 * p);
  const tone = Math.sin(2 * Math.PI * 1700 * p) * 0.25;
  return (noise(time * 2000 + beatStart * 123) * 0.75 + tone) * env * 0.18 * accent;
}

function padTone(freq: number, t: number) {
  return (
    0.65 * Math.sin(2 * Math.PI * freq * t) +
    0.25 * Math.sin(2 * Math.PI * freq * 2 * t + 0.9) +
    0.1 * Math.sin(2 * Math.PI * freq * 3 * t + 1.4)
  );
}

function leadTone(freq: number, t: number) {
  return (
    0.7 * Math.sin(2 * Math.PI * freq * t) +
    0.2 * Math.sin(2 * Math.PI * freq * 2 * t + 0.4) +
    0.1 * Math.sin(2 * Math.PI * freq * 4 * t + 1.2)
  );
}

function subTone(freq: number, t: number) {
  return (
    0.82 * Math.sin(2 * Math.PI * freq * t) +
    0.18 * Math.sin(2 * Math.PI * freq * 2 * t + 0.15)
  );
}

function pluckTone(freq: number, t: number) {
  return (
    0.55 * Math.sin(2 * Math.PI * freq * t) +
    0.3 * Math.sin(2 * Math.PI * freq * 3 * t + 0.1) +
    0.15 * Math.sin(2 * Math.PI * freq * 5 * t + 0.6)
  );
}

function pcmWav(spec: TrackSpec, sampleRate = 22050) {
  const { seconds, tempoBpm, progression, leadPattern, style } = spec;
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  const beatPeriod = 60 / tempoBpm;
  const bars = progression.length;
  const totalBeats = Math.max(1, Math.floor(seconds / beatPeriod));
  const barBeats = Math.max(1, Math.floor(totalBeats / bars));

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;

    const globalIn = Math.min(1, t * 1.6);
    const globalOut = Math.min(1, (seconds - t) * 2.4);
    const globalEnv = globalIn * globalOut;

    const beatIndex = Math.floor(t / beatPeriod);
    const beatInBar = beatIndex % barBeats;
    const barIndex = Math.min(
      progression.length - 1,
      Math.floor(beatIndex / barBeats),
    );
    const chord = progression[barIndex] ?? progression[progression.length - 1]!;
    const beatStartTime = beatIndex * beatPeriod;

    let sample = 0;
    const stepTime = beatPeriod / 4;
    const stepIndex = Math.floor(t / stepTime);
    const stepStart = stepIndex * stepTime;
    const stepPhase = t - stepStart;
    const note = leadPattern[stepIndex % leadPattern.length];

    if (style === "news") {
      // Style news: bright, staccato, drive médiatique.
      const accent = beatInBar === 0 ? 1.25 : 1;
      sample += kick(t, beatStartTime) * accent * 1.05;
      if (beatInBar % 4 === 1 || beatInBar % 4 === 3) {
        sample += clap(t, beatStartTime, beatInBar % 4 === 3 ? 1.25 : 1.05);
      }

      const bassPhase = (t - beatStartTime) % (beatPeriod / 2);
      const bassEnv = envAD(bassPhase, 0.006, 0.17);
      const bassFreq = midiToFreq(chord[0]! - 24);
      sample += subTone(bassFreq, t) * bassEnv * 0.45;

      for (const midi of chord) {
        sample += padTone(midiToFreq(midi + 12), t) * 0.055;
      }
      if (note !== null) {
        const leadEnv = envAD(stepPhase, 0.004, stepTime * 0.55);
        sample += leadTone(midiToFreq(note + 12), t) * leadEnv * 0.31;
      }
      sample += noise(i * 0.0009) * 0.008;
    } else if (style === "street") {
      // Style street: plus percussif, syncopé, grave et énergique.
      const offBeat = beatStartTime + beatPeriod * 0.5;
      sample += kick(t, beatStartTime) * 0.95;
      sample += kick(t, offBeat) * 0.55;
      if (beatInBar % 4 === 1 || beatInBar % 4 === 3) {
        sample += clap(t, beatStartTime, 1.15);
      }

      const triplet = beatPeriod / 3;
      const bassPhase = (t - beatStartTime) % triplet;
      const bassEnv = envAD(bassPhase, 0.004, 0.14);
      const bassFreq = midiToFreq(chord[0]! - 29);
      sample +=
        (subTone(bassFreq, t) * 0.8 + Math.sin(2 * Math.PI * bassFreq * 0.5 * t) * 0.2) *
        bassEnv *
        0.52;

      const arpTime = beatPeriod / 8;
      const arpIndex = Math.floor(t / arpTime);
      const arpMidi = chord[arpIndex % chord.length]!;
      const arpPhase = t - arpIndex * arpTime;
      sample += pluckTone(midiToFreq(arpMidi + 7), t) * envAD(arpPhase, 0.002, arpTime * 0.9) * 0.2;

      if (note !== null) {
        const leadEnv = envAD(stepPhase, 0.003, stepTime * 0.45);
        sample += pluckTone(midiToFreq(note + 7), t) * leadEnv * 0.24;
      }
      sample += noise(i * 0.0013) * 0.012;
    } else {
      // Style lofi: doux, arrondi, moins agressif.
      if (beatInBar % 2 === 0) {
        sample += kick(t, beatStartTime) * 0.62;
      }
      if (beatInBar % 4 === 2 || beatInBar % 4 === 3) {
        sample += clap(t, beatStartTime, 0.65);
      }

      const bassPhase = (t - beatStartTime) % beatPeriod;
      const bassEnv = envAD(bassPhase, 0.02, 0.45);
      const bassFreq = midiToFreq(chord[0]! - 19);
      sample += subTone(bassFreq, t) * bassEnv * 0.33;

      const wobble = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.23 * t);
      for (const midi of chord) {
        sample += padTone(midiToFreq(midi), t * wobble) * 0.07;
      }
      if (note !== null) {
        const leadEnv = envAD(stepPhase, 0.012, stepTime * 1.2);
        sample += leadTone(midiToFreq(note), t) * leadEnv * 0.16;
      }
      sample += noise(i * 0.00045) * 0.02;
    }

    const v = Math.max(-1, Math.min(1, softClip(sample * globalEnv)));
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
  const files: TrackSpec[] = [
    {
      name: "actualites.wav",
      seconds: 10,
      tempoBpm: 124,
      style: "news",
      progression: [
        [64, 68, 71], // E
        [61, 65, 68], // C#
        [66, 69, 73], // F#
        [63, 67, 70], // D#
      ],
      leadPattern: [76, 78, null, 81, 79, null, 78, 76, null, 79, 81, null],
    },
    {
      name: "marche.wav",
      seconds: 12,
      tempoBpm: 132,
      style: "street",
      progression: [
        [55, 59, 62], // Gm
        [58, 62, 65], // A#
        [53, 57, 60], // F
        [60, 63, 67], // Cm
      ],
      leadPattern: [67, null, 70, 72, null, 74, 72, null, 70, 67, null, 65],
    },
    {
      name: "doux.wav",
      seconds: 11,
      tempoBpm: 78,
      style: "lofi",
      progression: [
        [60, 64, 67], // C
        [55, 59, 62], // G
        [57, 60, 64], // A minor
        [53, 57, 60], // F
      ],
      leadPattern: [67, null, 69, null, 67, 64, null, 62],
    },
  ];
  for (const file of files) {
    await writeFile(
      path.join(dir, file.name),
      pcmWav(file),
    );
  }
  return files.map((f) => ({
    file: f.name,
    url: `/soundtracks/${f.name}`,
    durationMs: f.seconds * 1000,
  }));
}
