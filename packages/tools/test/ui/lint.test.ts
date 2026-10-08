import { describe, expect, it } from "vitest";
import { currentId, t } from "../../../client/src/ui/t";
import { inspectSsr, scanCss, scanTs } from "../../src/ui-lint/checks";
import { auditPolicy } from "../../src/ui-shots/policy";
import { compareGenerated } from "../../src/ui-strings/index";

describe("hostile UI inputs", () => {
  it.each([
    `const x = <div>unlisted copy</div>`,
    `const x = <input title="secret helper"/>`,
    `const word='extra'; const copy=word+' helper'; const x=<div>{copy}</div>`,
    `const word='extra'; const x=<input aria-label={word}/>`,
    `const x={placeholder:'filler'}`,
  ])("rejects text reaching a visible sink", (source) => {
    expect(scanTs("src/ui/screens/bad.tsx", source).length).toBeGreaterThan(0);
  });
  it("rejects color and screen size literals", () => {
    expect(
      scanCss("ui/screens/bad.css", ".x{color:rgb(1 2 3);width:44px}").map(
        (row) => row.rule,
      ),
    ).toEqual(["raw-color", "screen-pixels"]);
    expect(scanCss("ui/components/x.css", ".x{color:red}")).toHaveLength(1);
  });
  it("rejects unknown and future controls at SSR and string use", () => {
    expect(
      inspectSsr(
        '<button data-ui="tools.postcard"></button><span data-text-id="invented.label"></span>',
      ).errors,
    ).toHaveLength(2);
    expect(() => t("tools.postcard")).toThrow();
  });
  it("rejects missing substitutions", () => {
    expect(() => t("toast.fly")).toThrow();
    expect(t("toast.fly", { n: 8 })).toBe("Fly speed ×8");
  });
  it("rejects inline colors, screen pixels and dormant future rows", () => {
    expect(
      scanTs(
        "src/ui/screens/bad.tsx",
        `const x=<div style={{color:'#ffffff',width:'25px'}}><Text id="tools.postcard"/></div>`,
      ).map((row) => row.rule),
    ).toEqual(["inline-color", "inline-screen-pixels", "unknown-or-future-id"]);
  });
  it("rejects stale generated strings", () => {
    expect(
      compareGenerated(
        "strings.gen.json",
        '{"label":"Play"}',
        '{"label":"Welcome"}',
      ),
    ).toEqual(["stale generated file: strings.gen.json"]);
  });
  it("uses the same phase boundary in browser, SSR and strings", () => {
    const policy = auditPolicy();
    expect(policy.phase).toBe("1.2");
    for (const id of ["title.play", "title.world", "map.teleport", "unit.km"]) {
      expect(policy.currentIds).toContain(id);
      expect(currentId(id)).toBe(true);
      expect(inspectSsr(`<button data-ui="${id}"></button>`).errors).toEqual(
        [],
      );
    }
    for (const id of ["tools.postcard", "tools.view", "invented.label"]) {
      expect(policy.currentIds).not.toContain(id);
      expect(currentId(id)).toBe(false);
      expect(
        inspectSsr(`<button data-ui="${id}"></button>`).errors,
      ).toHaveLength(1);
    }
    expect(t("title.world")).toBe("World");
  });
  it("allows code IDs, token styles and translated expressions", () => {
    expect(
      scanTs(
        "src/ui/screens/ok.tsx",
        `import {t} from '../t'; const x=<button data-ui="title.play" aria-label={t('title.play')}>{t('title.play')}</button>`,
      ),
    ).toEqual([]);
    expect(
      scanCss(
        "ui/screens/ok.css",
        ".x{color:var(--text);width:var(--w-column)}",
      ),
    ).toEqual([]);
  });
});
