import data from "./world-evidence.json";
export type WorldHudRow = "hud.outline" | "hud.ghost" | "hud.silhouette";
export interface WorldEvidenceCase {
  readonly id: string;
  readonly rows: readonly WorldHudRow[];
  /** Paths are relative to packages/client/public, never external URLs. */
  readonly image: string;
  readonly imageSha256: string;
  readonly encoding?: {
    readonly sourceFormat: "png";
    readonly sourceImage: string;
    readonly sourceImageSha256: string;
    readonly encoder: "sharp";
    readonly encoderVersion: string;
    readonly format: "jpeg";
    readonly quality: 85;
    readonly width: 1280;
    readonly height: 720;
    readonly resized: false;
  };
  readonly telemetry: string;
  readonly telemetrySha256: string;
  readonly runReceipt: string;
  readonly runReceiptSha256: string;
  /** Repository-relative files captured after the renderer source was frozen. */
  readonly sources: readonly {
    readonly path: string;
    readonly sha256: string;
  }[];
}
export interface WorldEvidenceManifest {
  readonly version: 1;
  readonly cases: readonly WorldEvidenceCase[];
}
export const worldEvidence = data as WorldEvidenceManifest;
