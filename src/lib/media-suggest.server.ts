import {
  DetectLabelsCommand,
  DetectTextCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";

export type CleanupSuggestion = {
  id: string;
  kind: "text" | "logo";
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function hasAwsCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

let rekognition: RekognitionClient | null = null;

function getRekognition() {
  rekognition ??= new RekognitionClient({
    region: process.env.AWS_REGION?.trim() || "eu-west-1",
  });
  return rekognition;
}

function boxFrom(
  box:
    | { Left?: number; Top?: number; Width?: number; Height?: number }
    | undefined,
) {
  if (!box) return null;
  const left = Math.min(1, Math.max(0, box.Left ?? 0));
  const top = Math.min(1, Math.max(0, box.Top ?? 0));
  const width = Math.min(1 - left, Math.max(0.02, box.Width ?? 0));
  const height = Math.min(1 - top, Math.max(0.02, box.Height ?? 0));
  if (width < 0.015 || height < 0.015) return null;
  return { left, top, width, height };
}

export async function suggestMediaCleanup(
  buffer: Buffer,
): Promise<CleanupSuggestion[]> {
  if (!hasAwsCredentials()) return [];

  const bytes = new Uint8Array(buffer);
  const out: CleanupSuggestion[] = [];
  let n = 0;

  try {
    const text = await getRekognition().send(
      new DetectTextCommand({ Image: { Bytes: bytes } }),
    );
    for (const det of text.TextDetections ?? []) {
      if (det.Type !== "LINE" || (det.Confidence ?? 0) < 70) continue;
      const box = boxFrom(det.Geometry?.BoundingBox);
      if (!box) continue;
      n += 1;
      out.push({
        id: `text-${n}`,
        kind: "text",
        label: (det.DetectedText ?? "texte").slice(0, 80),
        ...box,
      });
    }
  } catch {
    /* suggestions optionnelles */
  }

  try {
    const labels = await getRekognition().send(
      new DetectLabelsCommand({
        Image: { Bytes: bytes },
        MinConfidence: 70,
        Features: ["GENERAL_LABELS"],
      }),
    );
    for (const label of labels.Labels ?? []) {
      const name = label.Name ?? "";
      if (!/logo|brand|trademark/i.test(name)) continue;
      for (const inst of label.Instances ?? []) {
        const box = boxFrom(inst.BoundingBox);
        if (!box) continue;
        n += 1;
        out.push({
          id: `logo-${n}`,
          kind: "logo",
          label: name,
          ...box,
        });
      }
    }
  } catch {
    /* suggestions optionnelles */
  }

  return out.slice(0, 20);
}
