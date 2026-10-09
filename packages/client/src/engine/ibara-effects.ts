import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  type Plane,
} from "three";
import { Block } from "../../../shared/src/blocks/registry.js";
import type { MeshPart } from "../../../shared/src/meshing/greedy.js";
import type { Point } from "../game/raycast.js";
import type { TerrainViewMode } from "./terrain-material.js";

export const IBARA_EFFECT_LIMITS = Object.freeze({
  anchorsPerChunk: 8,
  flames: 24,
  embersPerFlame: 8,
  embers: 192,
  radius: 128,
});
export interface VentAnchor extends Point {
  readonly phase: number;
}
/** Only exposed, upward vent mouths qualify. The renderer never scans or edits
 * generation, light sources, collision or saves. One anchor per 4 m cell avoids
 * hundreds of flames on a wide mouth; retained metadata is bounded per chunk. */
export function ventAnchors(part: MeshPart, origin: Point): VentAnchor[] {
  const anchors: VentAnchor[] = [],
    cells = new Set<string>();
  for (let i = 0; i < part.positions.length / 3; i += 4) {
    if (
      part.surfaces[i * 3] !== Block.VentMouth ||
      part.normals[i * 3 + 1] !== 1
    )
      continue;
    let x = 0,
      y = 0,
      z = 0;
    for (let j = 0; j < 4; j++) {
      x += part.positions[(i + j) * 3] as number;
      y += part.positions[(i + j) * 3 + 1] as number;
      z += part.positions[(i + j) * 3 + 2] as number;
    }
    x = origin.x + x / 4;
    y = origin.y + y / 4;
    z = origin.z + z / 4;
    const key = `${Math.floor(x / 4)},${Math.floor(y / 4)},${Math.floor(z / 4)}`;
    if (cells.has(key)) continue;
    cells.add(key);
    const h =
      (Math.imul(Math.floor(x), 0x9e3779b1) ^
        Math.imul(Math.floor(y), 0x85ebca77) ^
        Math.imul(Math.floor(z), 0xc2b2ae3d)) >>>
      0;
    anchors.push({ x, y, z, phase: (h / 0x100000000) * Math.PI * 2 });
    if (anchors.length === IBARA_EFFECT_LIMITS.anchorsPerChunk) break;
  }
  return anchors;
}

function flameGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, 0, 0, -0.5, 0, 0, 0.5, 0,
        1, 0.5, 0, 1, -0.5,
      ]),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new BufferAttribute(
      new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]),
      2,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geometry.setAttribute(
    "aFlamePhase",
    new InstancedBufferAttribute(
      new Float32Array(IBARA_EFFECT_LIMITS.flames),
      1,
    ),
  );
  return geometry;
}

/** Fixed allocation, analytic display-clock animation: repeated times give
 * identical poses, regardless of frame rate, pauses or world-clock jumps. */
export class IbaraEffects {
  readonly flames: InstancedMesh<BufferGeometry, MeshBasicMaterial>;
  readonly embers: InstancedMesh<BoxGeometry, MeshBasicMaterial>;
  private readonly time = { value: 0 };
  private readonly chunks = new Map<
    string,
    { worldId: number; anchors: readonly VentAnchor[] }
  >();
  private readonly dummy = new Object3D();
  private readonly emberColor = new Color();
  private worldId = 0;
  private mode: TerrainViewMode = "normal";
  private postcard = false;
  private sources = 0;
  private selected = 0;

  constructor(clip: Plane) {
    const material = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      clippingPlanes: [clip],
      forceSinglePass: true,
    });
    material.customProgramCacheKey = () => "coldfront-ibara-flame-v1";
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFlameTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
attribute float aFlamePhase;
uniform float uFlameTime;
varying vec2 vFlameUv;
flat varying float vFlamePhase;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vFlameUv=uv;
vFlamePhase=aFlamePhase;
transformed.x += sin(uFlameTime*2.7+aFlamePhase+uv.y*4.0)*uv.y*uv.y*0.13;
transformed.z += sin(uFlameTime*1.9+aFlamePhase)*uv.y*uv.y*0.08;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uFlameTime;
varying vec2 vFlameUv;
flat varying float vFlamePhase;`,
        )
        .replace(
          "#include <map_fragment>",
          `
float height=vFlameUv.y;
float edge=abs(vFlameUv.x-0.5)*2.0;
float tongues=0.08*sin(height*13.0-uFlameTime*4.0+vFlamePhase)+0.045*sin(height*27.0-uFlameTime*7.0);
float width=(1.0-height)*(0.8+tongues);
float alpha=(1.0-smoothstep(max(0.0,width-0.18),width,edge))*smoothstep(0.0,0.08,height)*(1.0-smoothstep(0.7,1.0,height));
if(alpha<0.02) discard;
diffuseColor.rgb=mix(vec3(12.0,6.2,1.1),vec3(5.4,0.65,0.08),height);
diffuseColor.rgb*=1.0+0.08*sin(uFlameTime*3.1+vFlamePhase);
diffuseColor.a=alpha*0.9;`,
        );
    };
    this.flames = new InstancedMesh(
      flameGeometry(),
      material,
      IBARA_EFFECT_LIMITS.flames,
    );
    this.embers = new InstancedMesh(
      new BoxGeometry(0.045, 0.075, 0.045),
      new MeshBasicMaterial({ clippingPlanes: [clip], depthWrite: false }),
      IBARA_EFFECT_LIMITS.embers,
    );
    this.embers.setColorAt(0, new Color(1, 1, 1));
    for (const mesh of [this.flames, this.embers]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.visible = false;
    }
  }
  register(key: string, worldId: number, anchors: readonly VentAnchor[]): void {
    this.remove(key);
    if (!anchors.length) return;
    const bounded = anchors.slice(0, IBARA_EFFECT_LIMITS.anchorsPerChunk);
    this.chunks.set(key, { worldId, anchors: bounded });
    this.sources += bounded.length;
  }
  remove(key: string): void {
    this.sources -= this.chunks.get(key)?.anchors.length ?? 0;
    this.chunks.delete(key);
    // Never leave old instances visible between removal and the next update.
    this.flames.count = this.embers.count = this.selected = 0;
  }
  setWorld(worldId: number): void {
    this.worldId = worldId;
    this.flames.count = this.embers.count = this.selected = 0;
  }
  setMode(mode: TerrainViewMode, postcard: boolean): void {
    this.mode = mode;
    this.postcard = postcard;
    this.flames.visible = mode === "normal";
    this.embers.visible = mode === "normal" && !postcard;
  }
  update(displayMs: number, cut: number, camera: Point): void {
    this.time.value = displayMs / 1000;
    this.flames.count = this.embers.count = this.selected = 0;
    if (this.mode !== "normal") return;
    const nearby: { anchor: VentAnchor; distance: number }[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.worldId !== this.worldId) continue;
      for (const anchor of chunk.anchors) {
        const distance =
          (anchor.x - camera.x) ** 2 +
          (anchor.y - camera.y) ** 2 +
          (anchor.z - camera.z) ** 2;
        if (anchor.y >= cut || distance > IBARA_EFFECT_LIMITS.radius ** 2)
          continue;
        // Keep the selection itself bounded as well as the GPU instance count.
        let slot = nearby.findIndex(
          (item) =>
            item.distance > distance ||
            (item.distance === distance &&
              (item.anchor.x > anchor.x ||
                (item.anchor.x === anchor.x &&
                  (item.anchor.y > anchor.y ||
                    (item.anchor.y === anchor.y &&
                      item.anchor.z > anchor.z))))),
        );
        if (slot < 0) slot = nearby.length;
        if (slot < IBARA_EFFECT_LIMITS.flames)
          nearby.splice(slot, 0, { anchor, distance });
        if (nearby.length > IBARA_EFFECT_LIMITS.flames) nearby.pop();
      }
    }
    const phase = this.flames.geometry.getAttribute(
      "aFlamePhase",
    ) as InstancedBufferAttribute;
    for (const { anchor } of nearby) {
      const i = this.flames.count++,
        seconds = displayMs / 1000,
        flicker = Math.sin(seconds * 3.1 + anchor.phase);
      this.dummy.position.set(anchor.x, anchor.y + 0.02, anchor.z);
      this.dummy.rotation.set(0, anchor.phase, 0);
      this.dummy.scale.set(1.3, 1.7 + flicker * 0.12, 1.3);
      this.dummy.updateMatrix();
      this.flames.setMatrixAt(i, this.dummy.matrix);
      phase.setX(i, anchor.phase);
      if (this.postcard) continue;
      for (let j = 0; j < IBARA_EFFECT_LIMITS.embersPerFlame; j++) {
        const p = anchor.phase + j * 2.399963,
          age =
            (((seconds * 0.24 +
              j / IBARA_EFFECT_LIMITS.embersPerFlame +
              anchor.phase / (Math.PI * 2)) %
              1) +
              1) %
            1,
          rise = age * 4.5;
        if (anchor.y + rise > cut) continue;
        this.dummy.position.set(
          anchor.x + Math.sin(p + age * 2) * age * 0.65 + age * age * 0.5,
          anchor.y + rise,
          anchor.z + Math.cos(p + age) * age * 0.65,
        );
        this.dummy.rotation.set(p, p, p);
        this.dummy.scale.setScalar(Math.sin(Math.PI * age));
        this.dummy.updateMatrix();
        const index = this.embers.count++;
        this.embers.setMatrixAt(index, this.dummy.matrix);
        this.emberColor.setRGB(7.5, 1.8 + age, 0.12);
        this.embers.setColorAt(index, this.emberColor);
      }
    }
    this.selected = nearby.length;
    phase.needsUpdate = true;
    this.flames.instanceMatrix.needsUpdate = true;
    this.embers.instanceMatrix.needsUpdate = true;
    if (this.embers.instanceColor) this.embers.instanceColor.needsUpdate = true;
  }
  get statistics(): {
    sourceChunks: number;
    sourceAnchors: number;
    sourceAnchorLimit: number;
    selected: number;
    flames: number;
    embers: number;
    maxFlames: number;
    maxEmbers: number;
    memory: number;
  } {
    return {
      sourceChunks: this.chunks.size,
      sourceAnchors: this.sources,
      sourceAnchorLimit: this.chunks.size * IBARA_EFFECT_LIMITS.anchorsPerChunk,
      selected: this.selected,
      flames: this.flames.visible ? this.flames.count : 0,
      embers: this.embers.visible ? this.embers.count : 0,
      maxFlames: IBARA_EFFECT_LIMITS.flames,
      maxEmbers: IBARA_EFFECT_LIMITS.embers,
      memory:
        this.flames.instanceMatrix.array.byteLength +
        this.embers.instanceMatrix.array.byteLength +
        (this.embers.instanceColor?.array.byteLength ?? 0) +
        this.flames.geometry.getAttribute("aFlamePhase").array.byteLength,
    };
  }
  dispose(): void {
    this.chunks.clear();
    this.sources = this.selected = 0;
    for (const mesh of [this.flames, this.embers]) {
      mesh.count = 0;
      mesh.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
