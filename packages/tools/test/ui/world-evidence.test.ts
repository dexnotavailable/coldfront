import { describe, expect, it } from "vitest";
import type { WorldEvidenceCase } from "../../../client/src/ui/gallery/world-evidence";
import {
  checkWorldEvidence,
  evidenceImageSize,
} from "../../src/ui-lint/world-evidence";
import { root } from "../../src/ui-strings/index";

const fake: WorldEvidenceCase = {
  id: "outline-ghost",
  rows: ["hud.outline", "hud.ghost"],
  image: "fixtures/ui/missing.png",
  imageSha256: "0".repeat(64),
  telemetry: "fixtures/ui/missing.json",
  telemetrySha256: "0".repeat(64),
  runReceipt: "fixtures/ui/missing-run.json",
  runReceiptSha256: "0".repeat(64),
  sources: [],
};
describe("world HUD evidence cannot be manufactured by SSR tags", () => {
  it("reads progressive JPEG dimensions through metadata and rejects truncation", () => {
    const header = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, 0xc2, 0, 8, 8, 2, 0xd0, 5, 0, 1,
      0xff, 0xd9,
    ]);
    expect(evidenceImageSize(header)).toEqual({
      format: "jpeg",
      width: 1280,
      height: 720,
    });
    expect(() => evidenceImageSize(header.subarray(0, 14))).toThrow();
    expect(() => evidenceImageSize(Buffer.from("not an image"))).toThrow();
  });
  it("an empty manifest gives no row credit", () =>
    expect(
      checkWorldEvidence({ version: 1, cases: [] }, root, new Set()),
    ).toEqual({ errors: [], covered: [] }));
  it("a rendered fixture ID without real image and receipt files still fails", () => {
    const result = checkWorldEvidence(
      { version: 1, cases: [fake] },
      root,
      new Set([fake.id]),
    );
    expect(result.covered).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
  it("rejects proof assets escaping the public root", () => {
    const result = checkWorldEvidence(
      { version: 1, cases: [{ ...fake, image: "../../package.json" }] },
      root,
      new Set([fake.id]),
    );
    expect(result.errors[0]).toContain("escapes its root");
    expect(result.covered).toEqual([]);
  });
  it("rejects an unrendered proof case", () => {
    const result = checkWorldEvidence(
      { version: 1, cases: [fake] },
      root,
      new Set(),
    );
    expect(result.errors[0]).toContain("absent from the SSR gallery");
    expect(result.covered).toEqual([]);
  });
});
