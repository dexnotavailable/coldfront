import { describe, expect, it } from "vitest";
import type { MainCameraCandidate } from "../../src/postcards/geometry.js";
import {
  ensembleFissureWitnesses,
  ensembleFramingScore,
  FOREST_ENSEMBLE_BUDGET,
  type ForestEnsemble,
  type ForestEnsembleMember,
  ordinaryForestEnsembles,
} from "../../src/postcards/hell-forest-ensemble.js";
import { sameHookBankScene } from "../../src/postcards/hell-framing-camera.js";

const anchor = { x: 100, z: 100 };
/** Accepted parameter fixtures only; no seed, plan, terrain, curves or voxels. */
function cluster(cellX: number, cellZ = 0): ForestEnsembleMember[] {
  return [30, 50, 70, 20].map((height, index) => ({
    id: (cellZ + 10) * 1000 + (cellX + 10) * 10 + index,
    cellX,
    cellZ,
    cluster: 0,
    base: [cellX * 192 + 60 + index * 20, 0, cellZ * 192 + 100] as const,
    height,
    baseRadius: 3,
    leanDegrees: 10,
    bend: 2,
    hooked: index === 0,
    broken: index === 3,
    branchCount: index === 1 ? 1 : 0,
    landmark: false,
    arch: false,
  }));
}
function nominate(members: readonly ForestEnsembleMember[]) {
  return ordinaryForestEnsembles(anchor, (x, z) =>
    members.filter((p) => p.cellX === x && p.cellZ === z),
  );
}
const wetAt = (site: { x: number; z: number }) =>
  [
    {
      fissureId: Math.round(site.x) * 100 + Math.round(site.z),
      x: Math.floor(site.x) + 0.5,
      y: -0.5,
      z: Math.floor(site.z) + 0.5,
    },
  ] as const;
const siteIds = (witnesses: ReturnType<typeof ensembleFissureWitnesses>) => [
  ...new Set(witnesses.map((witness) => witness.ensemble.id)),
];
const view: MainCameraCandidate = {
  region: "hellscape",
  kind: "eye-level",
  position: { x: 80.5, y: 1.62, z: -100.5 },
  target: { x: 80.5, y: 7.62, z: -36.5 },
  hours: 17.25,
  radius: 512,
};

describe("bounded ordinary forest ensemble nomination", () => {
  it("enumerates exactly 289 source cells and ranks distinct nominations independent of input order", () => {
    const population = [-8, -4, 0, 4, 8].flatMap((x) => cluster(x));
    const before = JSON.stringify(population);
    const calls: string[] = [];
    const sites = ordinaryForestEnsembles(anchor, (x, z) => {
      calls.push(`${x}:${z}`);
      return population.filter((p) => p.cellX === x && p.cellZ === z);
    });
    expect(calls).toHaveLength(FOREST_ENSEMBLE_BUDGET.cells);
    expect(new Set(calls).size).toBe(289);
    expect(sites).toHaveLength(5);
    expect(sites).toEqual(nominate([...population].reverse()));
    for (const site of sites) {
      expect(site.members.map((p) => p.height)).toEqual([30, 50, 70, 20]);
      for (const other of sites.filter((s) => s !== site))
        expect(
          Math.hypot(site.x - other.x, site.z - other.z),
        ).toBeGreaterThanOrEqual(384);
    }
    expect(JSON.stringify(population)).toBe(before);
    expect(siteIds(ensembleFissureWitnesses(sites, wetAt))).toHaveLength(3);
  });

  it("requires intact ordinary hooks, branches, breaks and three size classes without a fallback", () => {
    const population = cluster(0);
    expect(nominate(population)).toHaveLength(1);
    for (const invalid of [
      population.map((p) => ({ ...p, landmark: true })),
      population.map((p) => ({ ...p, hooked: false })),
      population.map((p) => ({ ...p, broken: p.broken || p.hooked })),
      population.map((p) => ({ ...p, branchCount: 0 })),
      population.map((p) => ({ ...p, broken: false })),
      population.filter((p) => p.height < 60),
    ])
      expect(nominate(invalid)).toEqual([]);
    let witnessCalls = 0;
    expect(
      ensembleFissureWitnesses([], () => {
        witnessCalls++;
        return [];
      }),
    ).toEqual([]);
    expect(witnessCalls).toBe(0);
  });

  it("does not spend separate site slots on adjacent clusters", () => {
    const sites = nominate([...cluster(0), ...cluster(1), ...cluster(4)]);
    expect(sites).toHaveLength(3);
    expect(siteIds(ensembleFissureWitnesses(sites, wetAt))).toHaveLength(2);
  });

  it("admits lower-ranked wet sites after the three highest-ranked nominations prove dry", () => {
    const sites = nominate([-8, -4, 0, 4, 8].flatMap((x) => cluster(x)));
    const dry = new Set(sites.slice(0, 3).map((site) => site.id));
    const events: Readonly<Record<string, unknown>>[] = [];
    const witnesses = ensembleFissureWitnesses(
      sites,
      (point) => {
        const site = point as ForestEnsemble;
        return wetAt({ ...site, x: site.x + (dry.has(site.id) ? 900 : 0) });
      },
      (event) => events.push(event),
    );
    expect(siteIds(witnesses)).toEqual(sites.slice(3).map((site) => site.id));
    expect(
      events
        .slice(0, 3)
        .every((event) => event.status === "rejected-no-joint-witness"),
    ).toBe(true);
    expect(events[0]).toMatchObject({
      rawWitnesses: 1,
      qualifiedWitnesses: 0,
      predicatePassCounts: {
        hookWithin144: 0,
        branchWithin144: 0,
        brokenWithin144: 0,
        allSizesWithin144: 0,
      },
    });
  });

  it("bounds nomination queries at32 and raw witnesses at24, with no dry-site fallback", () => {
    const population = Array.from({ length: 7 }, (_, z) =>
      Array.from({ length: 7 }, (_, x) => cluster(x - 3, z - 3)),
    ).flat(2);
    const sites = nominate(population);
    expect(sites).toHaveLength(32);
    expect(new Set(sites.map((site) => site.id)).size).toBe(32);
    let calls = 0;
    const events: Readonly<Record<string, unknown>>[] = [];
    const result = ensembleFissureWitnesses(
      [...sites, ...sites],
      (site) => {
        calls++;
        return Array.from({ length: 30 }, (_, i) => ({
          ...wetAt({ x: site.x + 900, z: site.z })[0],
          fissureId: i,
        }));
      },
      (event) => events.push(event),
    );
    expect(result).toEqual([]);
    expect(calls).toBe(32);
    expect(events).toHaveLength(32);
    expect(events.every((event) => event.rawWitnesses === 24)).toBe(true);
  });

  it("caches raw witness queries per centre and stops after three qualified distinct sites", () => {
    const sites = nominate([-8, -4, 0, 4, 8].flatMap((x) => cluster(x)));
    let calls = 0;
    const first = sites[0];
    if (!first) throw Error("Missing nomination");
    expect(
      ensembleFissureWitnesses([first, { ...first, id: "same-centre" }], () => {
        calls++;
        return [];
      }),
    ).toEqual([]);
    expect(calls).toBe(1);
    calls = 0;
    expect(
      siteIds(
        ensembleFissureWitnesses(sites, (site) => {
          calls++;
          return wetAt(site);
        }),
      ),
    ).toHaveLength(3);
    expect(calls).toBe(3);
  });

  it("uses the leaning-body envelope to penalize a nearby short obstruction without deleting it", () => {
    const clean = nominate([...cluster(0), ...cluster(4)]);
    const blocker = {
      ...(cluster(0)[0] as ForestEnsembleMember),
      id: 999999,
      height: 34,
      hooked: false,
      leanDegrees: 60,
      bend: 10,
      base: [70, 0, 105] as const,
    };
    const crowded = nominate([...cluster(0), blocker, ...cluster(4)]);
    expect(clean[0]?.id).toBe("0:0:0");
    expect(crowded[0]?.id).toBe("4:0:0");
    expect(crowded.find((s) => s.id === "0:0:0")?.members).toContainEqual(
      blocker,
    );
  });

  it("round-robins at most eight owned witness nominations per site and twenty-four overall", () => {
    const sites = nominate([...cluster(-4), ...cluster(0), ...cluster(4)]);
    const witnesses = ensembleFissureWitnesses(sites, (site) =>
      Array.from({ length: 30 }, (_, i) => ({
        fissureId: Math.round(site.x) * 100 + i,
        x: Math.floor(site.x) + 0.5,
        y: -0.5,
        z: Math.floor(site.z) + i + 0.5,
      })),
    );
    expect(witnesses).toHaveLength(24);
    expect(witnesses.slice(0, 3).map((w) => w.ensemble.id)).toEqual(
      sites.map((s) => s.id),
    );
    for (const site of sites)
      expect(witnesses.filter((w) => w.ensemble.id === site.id)).toHaveLength(
        8,
      );
    expect(new Set(witnesses.map((w) => w.fissureId)).size).toBe(24);
  });

  it("rejects a wet point that loses vocabulary from its actual root disc", () => {
    const sites = nominate(cluster(0));
    expect(
      ensembleFissureWitnesses(sites, () => [
        { fissureId: 7, x: -50.5, y: -0.5, z: 100.5 },
      ]),
    ).toEqual([]); // hook and branch fit; tall/broken members do not.
    expect(ensembleFissureWitnesses(sites, () => [])).toEqual([]);
  });

  it("prefers an envelope stand-off to a cropped close bank", () => {
    const site = nominate(cluster(0))[0];
    if (!site) throw Error("Missing fixture site");
    const close = {
      ...view,
      position: { ...view.position, z: 60.5 },
      target: { ...view.target, z: 124.5 },
    };
    expect(ensembleFramingScore(view, site)).toBeGreaterThan(
      ensembleFramingScore(close, site),
    );
  });
});

describe("semantic hook bank identity", () => {
  const first = {
    hookId: 1,
    witness: { fissureId: 7, x: 31.5, y: -0.5, z: 15.5 },
    view,
  };
  it("groups adjacent wet samples and nearby eyes across arbitrary bucket boundaries", () => {
    expect(
      sameHookBankScene(first, {
        ...first,
        witness: { ...first.witness, x: 32.5 },
        view: { ...view, position: { ...view.position, x: 82.5 } },
      }),
    ).toBe(true);
  });
  it("keeps another hook, owner or bank neighbourhood distinct", () => {
    for (const other of [
      { ...first, hookId: 2 },
      { ...first, witness: { ...first.witness, fissureId: 8 } },
      { ...first, witness: { ...first.witness, x: 80.5 } },
      { ...first, view: { ...view, position: { ...view.position, x: 100.5 } } },
    ])
      expect(sameHookBankScene(first, other)).toBe(false);
  });
});
