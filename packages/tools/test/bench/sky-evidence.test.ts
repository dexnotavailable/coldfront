import { expect, it } from "vitest";
import { Block } from "../../../shared/src/blocks/registry.js";
import { haloIndex } from "../../../shared/src/world/coordinates.js";
import { createWorldContext } from "../../../shared/src/world/world-context.js";
import { generateTestChunk } from "../../../shared/src/worldgen/chunk.js";
import { pipelineSkyEvidence } from "../../src/bench/pipeline.js";

it("requires water-filtering evidence for darkness and rejects exposed air or shallow water", () => {
  const context = createWorldContext({ kind: "test", seed: 1 });
  const chunk = generateTestChunk({ seed: 1, cx: 0, cy: 0, cz: 0 });
  expect(() => pipelineSkyEvidence(chunk, context.columns, 0)).toThrow(
    "submerged",
  );
  chunk.haloBlocks.fill(Block.Water);
  for (
    let i = context.columns.waterLevel;
    i < chunk.columns.length;
    i += context.columns.stride
  )
    chunk.columns[i] = 48;
  expect(pipelineSkyEvidence(chunk, context.columns, 0)).toEqual({
    state: "dark-submerged",
    reason:
      "Every open halo sample is water below enough additional water voxels to extinguish level-15 sunlight",
    minimumWaterVoxelsAboveOpenHalo: 8,
  });
  chunk.columns[context.columns.waterLevel] = 47;
  expect(() => pipelineSkyEvidence(chunk, context.columns, 0)).toThrow(
    "submerged",
  );
  chunk.columns[context.columns.waterLevel] = 48;
  chunk.haloBlocks[haloIndex(31, 39, 31)] = Block.Air;
  expect(() => pipelineSkyEvidence(chunk, context.columns, 0)).toThrow(
    "submerged",
  );
  expect(pipelineSkyEvidence(chunk, context.columns, 1).state).toBe("lit");
});
