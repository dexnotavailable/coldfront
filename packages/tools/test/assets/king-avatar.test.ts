import {
  Box3,
  type BoxGeometry,
  type Group,
  Mesh,
  type MeshLambertMaterial,
  Vector3,
} from "three";
import { OBB } from "three/addons/math/OBB.js";
import { describe, expect, it } from "vitest";
import { Avatar } from "../../../client/src/engine/avatar.js";
import {
  KING_CLOAK,
  KING_PIXEL,
  type KingAppearance,
  kingCloakPose,
} from "../../../client/src/engine/king-avatar.js";
import {
  makeBody,
  PHYSICS,
  stepBody,
} from "../../../client/src/game/controller.js";
import { Block } from "../../../shared/src/blocks/registry.js";

const appearance: KingAppearance = {
  kind: "king",
  kingdomColor: "#8fb3d9",
  kingdomAccent: "#d8b765",
};
function meshes(group: Group): Mesh<BoxGeometry, MeshLambertMaterial>[] {
  const result: Mesh<BoxGeometry, MeshLambertMaterial>[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) result.push(object);
  });
  return result;
}
function create(): Avatar {
  return new Avatar("#8fb3d9", "#10151d", appearance);
}
function obb(mesh: Mesh<BoxGeometry, MeshLambertMaterial>): OBB {
  mesh.geometry.computeBoundingBox();
  return new OBB()
    .fromBox3(mesh.geometry.boundingBox as Box3)
    .applyMatrix4(mesh.matrixWorld);
}

describe("King visual attachment contract", () => {
  it("keeps the default avatar plain, with identical inherited geometry and movement", () => {
    const plain = new Avatar("#8fb3d9", "#10151d"),
      king = create();
    const body = makeBody(0, 0, 0);
    expect(meshes(plain.group)).toHaveLength(11);
    expect(meshes(plain.group).some((m) => m.name.startsWith("king-"))).toBe(
      false,
    );
    for (const state of [
      {},
      { sprinting: true },
      { sneaking: true },
      { swimming: true },
      { flying: true },
    ]) {
      Object.assign(
        body,
        { sprinting: false, sneaking: false, swimming: false, flying: false },
        state,
        { vx: 0.3, walkDistance: 0.7, headYaw: 0.5 },
      );
      const before = structuredClone(body);
      plain.swing(0);
      king.swing(0);
      plain.step(0.6, 0);
      king.step(0.6, 0);
      plain.update(body, body, 1, 75, 0.01);
      king.update(body, body, 1, 75, 0.01);
      const base = meshes(plain.group),
        inherited = meshes(king.group).filter(
          (m) => !m.name.startsWith("king-"),
        );
      expect(inherited).toHaveLength(base.length);
      for (let i = 0; i < base.length; i++) {
        expect(inherited[i]?.geometry.parameters).toEqual(
          base[i]?.geometry.parameters,
        );
        expect(inherited[i]?.matrixWorld.elements).toEqual(
          base[i]?.matrixWorld.elements,
        );
      }
      expect(body).toEqual(before);
    }
    plain.dispose();
    king.dispose();
  });

  it("keeps the crown open and under 1.92 m; head turns leave the torso cloak fixed", () => {
    const king = create(),
      body = makeBody(0, 0, 0);
    king.update(body, body, 1, 0, 0.01);
    const crown = meshes(king.group).filter((m) =>
      m.name.startsWith("king-crown"),
    );
    expect(crown).toHaveLength(8);
    const bounds = new Box3();
    for (const part of crown) bounds.union(new Box3().setFromObject(part));
    expect(bounds.max.y).toBeCloseTo(34 * KING_PIXEL);
    expect(bounds.getSize(new Vector3()).x).toBeCloseTo(10 * KING_PIXEL);
    for (const part of crown)
      expect(
        new Box3()
          .setFromObject(part)
          .containsPoint(new Vector3(0, 31.5 * KING_PIXEL, 0)),
      ).toBe(false);
    const cloak = king.group.getObjectByName("king-cloak-panel-0") as Mesh;
    const cloakBefore = cloak.matrixWorld.clone(),
      crownBefore = crown[0]?.matrixWorld.clone();
    body.headYaw = Math.PI / 3;
    king.update(body, body, 1, 0, 0.01);
    expect(cloak.matrixWorld.equals(cloakBefore)).toBe(true);
    expect(
      crown[0]?.matrixWorld.equals(crownBefore as import("three").Matrix4),
    ).toBe(false);
    king.dispose();
  });

  it("copies every final attachment transform into cover silhouette and depth", () => {
    const king = create(),
      body = Object.assign(makeBody(), {
        headYaw: 0.8,
        yaw: -0.4,
        sprinting: true,
        vx: 0.3,
        walkDistance: 1.2,
      });
    king.setWind({ x: 1, z: 0.4, strength: 0.8 });
    king.update(body, body, 1, 1432, 0.01);
    const original = meshes(king.group),
      depth = meshes(king.depth),
      silhouette = meshes(king.silhouette);
    expect(depth).toHaveLength(original.length);
    expect(silhouette).toHaveLength(original.length * 2);
    for (const mesh of original) {
      expect(
        depth.some(
          (copy) =>
            copy.geometry === mesh.geometry &&
            copy.matrix.equals(mesh.matrixWorld),
        ),
      ).toBe(true);
      expect(
        silhouette.some(
          (copy) =>
            copy.geometry === mesh.geometry &&
            copy.matrix.equals(mesh.matrixWorld),
        ),
      ).toBe(true);
    }
    king.dispose();
  });

  it("bounds wind deflection and freezes exactly at a paused display time", () => {
    const king = create(),
      body = makeBody(0, 0, 0);
    const tip = (): Vector3 =>
      (king.group.getObjectByName("king-cloak-joint-3") as Group).localToWorld(
        new Vector3(0, -KING_CLOAK.lengths[3] * KING_PIXEL, 0),
      );
    for (const state of [
      {},
      { sprinting: true },
      { sneaking: true },
      { flying: true },
      { swimming: true },
    ]) {
      Object.assign(
        body,
        { sprinting: false, sneaking: false, flying: false, swimming: false },
        state,
      );
      for (let ms = 0; ms < 6000; ms += 125) {
        king.setWind({ x: 0, z: 0, strength: 0 });
        // Explicit clock rewind resets a fixed-time study to its settled pose.
        king.update(body, body, 1, -1, 0.01);
        king.update(body, body, 1, ms, 0.01);
        const rest = tip();
        for (const [x, z] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
          [1, 1],
        ]) {
          const wind = { x: x as number, z: z as number, strength: 1 };
          king.setWind(wind);
          king.update(body, body, 1, -1, 0.01);
          king.update(body, body, 1, ms, 0.01);
          expect(tip().distanceTo(rest)).toBeLessThanOrEqual(0.18);
          const pose = kingCloakPose(body, ms, wind);
          expect(
            Math.abs(
              pose.upperPitch +
                pose.middlePitch +
                pose.lowerPitch +
                pose.tipPitch,
            ),
          ).toBeLessThan((45 * Math.PI) / 180);
          expect(Math.abs(pose.sway)).toBeLessThanOrEqual((6 * Math.PI) / 180);
        }
      }
    }
    const before = meshes(king.group).map((m) => [...m.matrixWorld.elements]);
    king.update(body, body, 1, 5875, 0.01);
    expect(meshes(king.group).map((m) => m.matrixWorld.elements)).toEqual(
      before,
    );
    king.dispose();
  });

  it("keeps the cloak clear of body limbs and the ground through the gait cycle", () => {
    const king = create(),
      body = makeBody(0, 0, 0);
    for (const state of [
      {},
      { sprinting: true },
      { sneaking: true },
      { flying: true },
      { swimming: true },
    ]) {
      Object.assign(
        body,
        {
          sprinting: false,
          sneaking: false,
          flying: false,
          swimming: false,
          vx: 0.3,
        },
        state,
      );
      for (let frame = 0; frame < 72; frame++) {
        body.walkDistance = ((frame / 72) * Math.PI * 2) / 2.5;
        const ms = frame * 125;
        for (const [x, z] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          king.setWind({ x: x as number, z: z as number, strength: 1 });
          king.update(body, body, 1, -1, 0.01);
          king.update(body, body, 1, ms, 0.01);
          const originals = meshes(king.group).filter(
              (m) => !m.name.startsWith("king-"),
            ),
            panels = meshes(king.group).filter((m) =>
              m.name.startsWith("king-cloak-panel"),
            );
          for (const panel of panels) {
            // A tiny inset excludes a seam touching the inner side of an arm.
            const p = obb(panel);
            p.halfSize.multiplyScalar(0.999);
            for (const limb of originals)
              expect(
                p.intersectsOBB(obb(limb)),
                `${JSON.stringify(state)} frame ${frame} ${panel.name}`,
              ).toBe(false);
            if (!body.swimming)
              expect(new Box3().setFromObject(panel).min.y).toBeGreaterThan(0);
          }
        }
      }
    }
    king.dispose();
  });

  it("does not change controller steps, collision or action origin during a replay", () => {
    const plain = new Avatar("#8fb3d9", "#10151d"),
      king = create(),
      a = makeBody(0.5, 1, 0.5),
      b = structuredClone(a);
    const get = (_x: number, y: number, z: number): number =>
      y < 1 || (z === -4 && y < 3) ? Block.Stone : Block.Air;
    for (let tick = 0; tick < 80; tick++) {
      const input = {
        forward: 1,
        right: tick > 45 ? 1 : 0,
        jump: tick === 20,
        sneak: tick > 65,
        sprint: tick < 30,
        yaw: 0,
        lookYaw: 0,
        fly: false,
        flySpeed: 1,
      };
      stepBody(a, input, get);
      stepBody(b, input, get);
      plain.update(a, a, 1, tick * 50, 0.01);
      king.update(b, b, 1, tick * 50, 0.01);
      expect(a).toEqual(b);
      expect(a.y + (a.sneaking ? PHYSICS.sneakEye : PHYSICS.eye)).toBe(
        b.y + (b.sneaking ? PHYSICS.sneakEye : PHYSICS.eye),
      );
    }
    plain.dispose();
    king.dispose();
  });

  it("keeps cloth non-emissive with its base palette and low-contrast three-tone weave", () => {
    const king = create(),
      panels = meshes(king.group).filter((part) =>
        part.name.startsWith("king-cloak-panel"),
      );
    expect(panels).toHaveLength(12);
    const textures = new Set(panels.map((part) => part.material.map));
    expect(textures.size).toBe(6);
    for (const panel of panels) {
      expect(panel.material.type).toBe("MeshLambertMaterial");
      expect(panel.material.emissive.getHex()).toBe(0);
      expect(panel.material.fog).toBe(true);
    }
    for (const texture of textures) {
      if (!texture) throw new Error("Cloak texture missing");
      const data = (texture.image as { data: Uint8Array }).data,
        tones = new Set<number>(),
        clothRed: number[] = [];
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index] as number,
          g = data[index + 1] as number,
          b = data[index + 2] as number;
        // Supplied blue/gold trim is separate from the #303d48 fabric ramp.
        if (r > 100 || g > 100 || b > 100) continue;
        for (const [value, base] of [
          [r, 48],
          [g, 61],
          [b, 72],
        ]) {
          expect(value).toBeGreaterThanOrEqual(
            Math.round((base as number) * 0.92),
          );
          expect(value).toBeLessThanOrEqual(
            Math.round((base as number) * 1.08),
          );
        }
        tones.add(r);
        clothRed.push(r);
      }
      expect(tones.size).toBeGreaterThanOrEqual(3);
      const mean =
        clothRed.reduce((sum, value) => sum + value, 0) / clothRed.length;
      expect(mean).toBeGreaterThan(48 * 0.98);
      expect(mean).toBeLessThan(48 * 1.03);
    }
    king.dispose();
  });

  it("disposes each generated map and attachment geometry/material once", () => {
    const king = create(),
      parts = meshes(king.group),
      maps = new Set(
        parts.map((m) => m.material.map).filter((m) => m !== null),
      );
    expect(maps.size).toBe(9);
    let disposedTextures = 0,
      disposedGeometry = 0,
      disposedMaterials = 0;
    for (const map of maps)
      map.addEventListener("dispose", () => disposedTextures++);
    for (const mesh of parts)
      mesh.geometry.addEventListener("dispose", () => disposedGeometry++);
    const materials = new Set(parts.map((m) => m.material));
    for (const material of materials)
      material.addEventListener("dispose", () => disposedMaterials++);
    king.dispose();
    expect(disposedTextures).toBe(maps.size);
    expect(disposedGeometry).toBe(parts.length);
    expect(disposedMaterials).toBe(materials.size);
  });
});
