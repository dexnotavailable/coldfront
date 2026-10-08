import { describe, expect, it } from "vitest";
import { SHELL_BINDINGS } from "../../../client/src/bootstrap/input.js";
import { WORLD_BINDINGS } from "../../../client/src/game/bindings.js";
import { catalogue, currentId } from "../../../client/src/ui/t.js";

describe("complete phase 1.2 input registry", () => {
  it("routes every current catalogue binding exactly once across shell and engine", () => {
    const listed = Object.entries(catalogue)
      .filter(([id, row]) => currentId(id) && row.kind === "binding")
      .map(([id]) => id)
      .sort();
    const routed = [
      ...Object.values(SHELL_BINDINGS),
      ...WORLD_BINDINGS.map((binding) => binding.id),
    ].sort();
    expect(routed).toEqual(listed);
    expect(new Set(routed).size).toBe(23);
    const keyboardCodes = [
      ...Object.keys(SHELL_BINDINGS),
      ...WORLD_BINDINGS.flatMap((binding) =>
        "code" in binding ? [binding.code] : [],
      ),
    ];
    expect(new Set(keyboardCodes).size).toBe(keyboardCodes.length);
  });
});
