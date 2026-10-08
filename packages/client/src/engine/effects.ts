import {
  BoxGeometry,
  Color,
  DataTexture,
  InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  Object3D,
  RGBAFormat,
  SRGBColorSpace,
} from "three";
import {
  generateTextureArray,
  TEXTURE_RECIPES,
} from "../../../shared/src/blocks/textures/recipes.js";
import type { Point } from "../game/raycast.js";
import { ease } from "./motion.js";

const tiles = generateTextureArray();
const blockTextures = new Map<number, DataTexture>();
function tile(layer: number): DataTexture {
  let texture = blockTextures.get(layer);
  if (!texture) {
    texture = new DataTexture(
      tiles.data.slice(layer * 1024, (layer + 1) * 1024),
      16,
      16,
      RGBAFormat,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    blockTextures.set(layer, texture);
  }
  return texture;
}
export function blockMaterials(block: number, ghost = false): Material[] {
  return [0, 0, 3, block === 4 ? -6 : 0, 0, 0].map((offset) => {
    const map = tile(block * 6 + offset);
    return ghost
      ? new MeshBasicMaterial({
          map,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          toneMapped: false,
        })
      : new MeshLambertMaterial({ map });
  });
}
export function blockIcon(block: number): string {
  const rgb = TEXTURE_RECIPES[block]?.rgb ?? [128, 128, 128];
  const color = (factor: number) =>
    `rgb(${rgb.map((c) => Math.round(c * factor)).join(",")})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2 29 9 16 16 3 9Z" fill="${color(1)}"/><path d="M3 9 16 16 16 30 3 23Z" fill="${color(0.75)}"/><path d="M16 16 29 9 29 23 16 30Z" fill="${color(0.55)}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
interface Grain {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  time: number;
  color: Color;
}
export class BlockEffects {
  readonly particles = new InstancedMesh(
    new BoxGeometry(0.12, 0.12, 0.12),
    new MeshLambertMaterial(),
    384,
  );
  readonly pop = new Mesh(new BoxGeometry(1, 1, 1), blockMaterials(2));
  readonly ghost = new Mesh(
    new BoxGeometry(1.005, 1.005, 1.005),
    blockMaterials(2, true),
  );
  private grains: Grain[] = [];
  private popTime = -1000;
  private popBlock = 2;
  private ghostBlock = 2;
  private readonly dummy = new Object3D();
  constructor() {
    this.particles.setColorAt(0, new Color(1, 1, 1));
    this.particles.count = 0;
    this.pop.visible = false;
    this.ghost.visible = false;
    this.particles.frustumCulled = false;
  }
  broken(position: Point, block: number, displayMs: number): void {
    const rgb = TEXTURE_RECIPES[block]?.rgb ?? [128, 128, 128],
      color = new Color(`rgb(${rgb.join(",")})`);
    for (let i = 0; i < 24; i++) {
      const h =
        (Math.imul(i + 1, 0x9e3779b1) ^
          Math.imul(position.x | 0, 0x85ebca77) ^
          Math.imul(position.z | 0, 0xc2b2ae3d)) >>>
        0;
      this.grains.push({
        x: position.x + 0.1 + ((h & 255) / 255) * 0.8,
        y: position.y + 0.2 + (((h >>> 8) & 255) / 255) * 0.6,
        z: position.z + 0.1 + (((h >>> 16) & 255) / 255) * 0.8,
        vx: ((h & 255) / 255 - 0.5) * 2.6,
        vy: 0.6 + (((h >>> 8) & 255) / 255) * 1.5,
        vz: (((h >>> 16) & 255) / 255 - 0.5) * 2.6,
        time: displayMs,
        color,
      });
    }
    if (this.grains.length > 384)
      this.grains.splice(0, this.grains.length - 384);
  }
  placed(position: Point, block: number, displayMs: number): void {
    if (block !== this.popBlock) {
      for (const m of this.pop.material as Material[]) m.dispose();
      this.pop.material = blockMaterials(block);
      this.popBlock = block;
    }
    this.pop.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    this.popTime = displayMs;
    this.pop.visible = true;
  }
  placementActive(displayMs: number): boolean {
    return displayMs >= this.popTime && displayMs - this.popTime < 100;
  }
  reset(): void {
    this.grains = [];
    this.popTime = -1000;
    this.pop.visible = this.ghost.visible = false;
    this.particles.count = 0;
  }
  setGhost(position: Point | null, block: number): void {
    this.ghost.visible = position !== null;
    if (!position) return;
    if (block !== this.ghostBlock) {
      for (const m of this.ghost.material as Material[]) m.dispose();
      this.ghost.material = blockMaterials(block, true);
      this.ghostBlock = block;
    }
    this.ghost.position.set(
      position.x + 0.5,
      position.y + 0.5,
      position.z + 0.5,
    );
  }
  update(displayMs: number, cut: number, camera: Point): void {
    const age = displayMs - this.popTime;
    this.pop.visible = age >= 0 && age < 100;
    if (this.pop.visible)
      this.pop.scale.setScalar(0.82 + ease("ease-out", age / 100) * 0.18);
    this.grains = this.grains.filter((g) => displayMs - g.time < 450);
    let count = 0;
    for (const g of this.grains) {
      const t = (displayMs - g.time) / 1000;
      const x = g.x + g.vx * t,
        y = g.y + g.vy * t - 4.9 * t * t,
        z = g.z + g.vz * t;
      if (y > cut) continue;
      const fade = Math.min(
        1,
        Math.hypot(x - camera.x, y - camera.y, z - camera.z) / 8,
      );
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(t * 4, t * 3, t * 2);
      this.dummy.scale.setScalar(fade * (1 - t / 0.45));
      this.dummy.updateMatrix();
      this.particles.setMatrixAt(count, this.dummy.matrix);
      this.particles.setColorAt(count, g.color);
      count++;
    }
    this.particles.count = count;
    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor)
      this.particles.instanceColor.needsUpdate = true;
  }
  dispose(): void {
    this.particles.geometry.dispose();
    (this.particles.material as Material).dispose();
    for (const mesh of [this.pop, this.ghost]) {
      mesh.geometry.dispose();
      for (const m of mesh.material as Material[]) m.dispose();
    }
  }
}
