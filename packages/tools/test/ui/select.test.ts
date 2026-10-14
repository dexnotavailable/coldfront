import { createElement } from "preact";
import { renderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import {
  Select,
  type SelectOption,
} from "../../../client/src/ui/components/Select";
import { worldOptions } from "../../../client/src/ui/gallery/phase12";
import { inspectSsr } from "../../src/ui-lint/checks";

describe("typed Select options", () => {
  it("keeps stable values separate from catalogue labels and credits actual rows", () => {
    const html = renderToString(
      createElement(Select, {
        id: "title.world",
        value: "main",
        options: worldOptions,
        onChange: () => {},
        initialOpen: true,
      }),
    );
    expect(html).toContain("Kaldmark");
    expect(html).toContain("Test world");
    expect(html).not.toContain('data-content="Kaldmark"');
    expect(inspectSsr(html).ids).toEqual(
      expect.arrayContaining([
        "title.world",
        "title.world.main",
        "title.world.test",
      ]),
    );
    expect(inspectSsr(html).errors).toEqual([]);
  });
  it("uses declared content for region names without fabricating catalogue IDs", () => {
    const options: readonly SelectOption[] = [
      { value: "hellscape", label: { kind: "content", name: "Ibara" } },
    ];
    const html = renderToString(
      createElement(Select, {
        id: "tools.region",
        value: "hellscape",
        options,
        onChange: () => {},
      }),
    );
    expect(html).toContain('data-content="Ibara"');
    expect(html).not.toContain('data-ui="hellscape"');
  });
  it("rejects future catalogue labels and duplicate stable values", () => {
    const options: readonly SelectOption[] = [
      { value: "late", label: { kind: "catalogue", id: "tools.lod" } },
    ];
    expect(() =>
      renderToString(
        createElement(Select, {
          id: "title.world",
          value: "late",
          options,
          onChange: () => {},
        }),
      ),
    ).toThrow(/not available/);
    expect(() =>
      renderToString(
        createElement(Select, {
          id: "title.world",
          value: "main",
          options: [worldOptions[0]!, worldOptions[0]!],
          onChange: () => {},
        }),
      ),
    ).toThrow(/Duplicate/);
  });
});
