import {
  type ColorRepresentation,
  DataTexture,
  type Group,
  type IUniform,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
  type Vector3,
} from "three";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import {
  decodeFarY,
  FAR_COLUMN_COUNT,
  FAR_SIZE,
  farColumnIndex,
  farSpacing,
} from "../../../shared/src/worldgen/far/coordinates.js";
import type { FarTileRuns } from "../../../shared/src/worldgen/far/types.js";
import {
  FAR_NEAR_COVERAGE_GLSL,
  type FarNearColumn,
  type FarTerrainCoverage,
} from "./far-terrain-coverage.js";

/** The structural subset of FarRenderHandle used by FarCapHooks. */
export interface FarCapHandle {
  readonly id: number;
  readonly runs: FarTileRuns;
}

/** A real horizontal cross-section of the retained runs, not their heightmap.
 * Occupancy has exactly the near cap semantics: solid, excluding leaves.
 * The half-open [bottom,top) rule preserves voids and fractional crossings.
 * No block, ore, light or feature identity reaches the cap's GPU texture.
 */
export function farCutOccupancy(
  tile: FarTileRuns,
  height: number,
  out: Uint8Array = new Uint8Array(FAR_SIZE * FAR_SIZE),
): Uint8Array {
  if (out.length !== FAR_SIZE * FAR_SIZE)
    throw new RangeError("Far cap occupancy must be 32 by 32");
  if (!Number.isFinite(height) && height !== Infinity)
    throw new RangeError("Invalid far cap cut");
  if (
    tile.offsets.length !== FAR_COLUMN_COUNT + 1 ||
    tile.words.length % 4 !== 0 ||
    tile.offsets[0] !== 0 ||
    Number(tile.offsets[FAR_COLUMN_COUNT]) * 4 !== tile.words.length
  )
    throw new RangeError("Invalid far cap run buffers");
  out.fill(0);
  if (height === Infinity) return out;
  for (let z = 0; z < FAR_SIZE; z++) {
    for (let x = 0; x < FAR_SIZE; x++) {
      const column = farColumnIndex(x, z);
      let low = Number(tile.offsets[column]);
      let high = Number(tile.offsets[column + 1]);
      if (low > high || high * 4 > tile.words.length)
        throw new RangeError("Invalid far cap run offsets");
      // Authoritative runs are sorted and disjoint. Find the first top > cut.
      const end = high;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const top = decodeFarY(Number(tile.words[middle * 4]) >>> 16);
        if (top <= height) low = middle + 1;
        else high = middle;
      }
      if (low === end) continue;
      const endpoints = Number(tile.words[low * 4]);
      const bottom = decodeFarY(endpoints & 0xffff);
      const block = Number(tile.words[low * 4 + 1]) & 0xffff;
      if (
        bottom <= height &&
        BLOCK_REGISTRY[block]?.solid &&
        block !== Block.Leaves
      )
        out[x + FAR_SIZE * z] = 255;
    }
  }
  return out;
}

export interface FarCutCapsOptions {
  /** The existing neutral cap colour supplied by the renderer. */
  readonly color: ColorRepresentation;
  readonly coverage: FarTerrainCoverage;
  readonly origin: IUniform<Vector3>;
}
interface CapResource {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly texture: DataTexture;
  readonly data: Uint8Array<ArrayBuffer>;
  filled: boolean;
}
interface CapEntry {
  readonly handle: FarCapHandle;
  readonly group: Group;
  visible: boolean;
  resource: CapResource | null;
}

/**
 * Structural FarCapHooks implementation. One shared plane, one 1 KiB occupancy
 * texture/material per retained tile. The same borrowed coverage mask discards
 * partial near footprints in fragments, even inside a 64 m far cell.
 * Renderer release owns per-tile lifetime; dispose() releases the shared plane.
 */
export class FarCutCaps {
  private readonly entries = new Map<number, CapEntry>();
  private geometry: PlaneGeometry | null = null;
  private cut = Infinity;
  private disposed = false;

  constructor(private readonly options: FarCutCapsOptions) {}

  prepare(handle: FarCapHandle, group: Group): void {
    if (this.disposed) throw new Error("Far caps disposed");
    const existing = this.entries.get(handle.id);
    if (existing) {
      if (existing.handle !== handle || existing.group !== group)
        throw new Error("Far cap handle collision");
      if (!existing.resource) this.createResource(existing);
      return;
    }
    const entry: CapEntry = { handle, group, visible: false, resource: null };
    this.createResource(entry);
    this.entries.set(handle.id, entry);
  }

  private createResource(entry: CapEntry): void {
    const tile = entry.handle.runs;
    const width = FAR_SIZE * farSpacing(tile.address);
    const data = new Uint8Array(FAR_SIZE * FAR_SIZE);
    farCutOccupancy(tile, this.cut, data);
    const texture = new DataTexture(
      data,
      FAR_SIZE,
      FAR_SIZE,
      RedFormat,
      UnsignedByteType,
    );
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    // Same unlit neutral finish as CutCap; never use the terrain palette here.
    const material = new MeshBasicMaterial({
      color: this.options.color,
      toneMapped: false,
    });
    material.customProgramCacheKey = () => "coldfront-far-occupancy-cap-v1";
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFarSolid = { value: texture };
      shader.uniforms.uRenderOrigin = this.options.origin;
      this.options.coverage.bind(shader.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec3 uRenderOrigin;
varying vec2 vCapUV;
varying vec2 vFarCapWorld;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vCapUV=uv;
vFarCapWorld=(mat3(modelMatrix)*transformed+(modelMatrix[3].xyz-uRenderOrigin)).xz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D uFarSolid;
uniform vec3 uRenderOrigin;
varying vec2 vCapUV;
varying vec2 vFarCapWorld;
${FAR_NEAR_COVERAGE_GLSL}`,
        )
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
if(texture2D(uFarSolid,vec2(vCapUV.x,1.0-vCapUV.y)).r<0.5) discard;
if(cfNearCovers(vFarCapWorld+uRenderOrigin.xz)) discard;`,
        );
    };
    this.geometry ??= new PlaneGeometry(1, 1);
    const mesh = new Mesh(this.geometry, material);
    mesh.name = `far-cap:${entry.handle.id}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width, width, 1);
    mesh.position.set(
      (tile.address.tx + 0.5) * width,
      Number.isFinite(this.cut) ? this.cut : 0,
      (tile.address.tz + 0.5) * width,
    );
    const filled = data.some((value) => value !== 0);
    mesh.visible = entry.visible && filled;
    entry.resource = { mesh, texture, data, filled };
    entry.group.add(mesh);
  }

  setVisible(handle: FarCapHandle, visible: boolean): void {
    const entry = this.entries.get(handle.id);
    if (!entry || entry.handle !== handle) return;
    entry.visible = visible;
    if (entry.resource)
      entry.resource.mesh.visible = visible && entry.resource.filled;
  }

  setCut(height: number, coverage: readonly FarNearColumn[]): void {
    if (this.disposed) throw new Error("Far caps disposed");
    if (!Number.isFinite(height) && height !== Infinity)
      throw new RangeError("Invalid far cap cut");
    // Idempotent when onNearCoverage already committed this same shared mask.
    this.options.coverage.update(coverage);
    if (height === this.cut) return;
    this.cut = height;
    for (const entry of this.entries.values()) {
      const resource = entry.resource;
      if (!resource) continue;
      farCutOccupancy(entry.handle.runs, height, resource.data);
      resource.texture.needsUpdate = true;
      resource.filled = resource.data.some((value) => value !== 0);
      resource.mesh.visible = entry.visible && resource.filled;
      resource.mesh.position.y = Number.isFinite(height) ? height : 0;
    }
  }

  private dropResource(entry: CapEntry): void {
    const resource = entry.resource;
    if (!resource) return;
    resource.mesh.removeFromParent();
    resource.texture.dispose();
    resource.mesh.material.dispose();
    entry.resource = null;
  }

  release(handle: FarCapHandle): void {
    const entry = this.entries.get(handle.id);
    if (!entry || entry.handle !== handle) return;
    this.dropResource(entry);
    this.entries.delete(handle.id);
  }

  contextLost(): void {
    if (this.disposed) return;
    for (const entry of this.entries.values()) this.dropResource(entry);
    this.geometry?.dispose();
    this.geometry = null;
  }

  contextRestored(handle: FarCapHandle): void {
    if (this.disposed) throw new Error("Far caps disposed");
    const entry = this.entries.get(handle.id);
    if (!entry || entry.handle !== handle)
      throw new Error("Unknown far cap handle");
    if (!entry.resource) this.createResource(entry);
    this.options.coverage.contextRestored();
  }

  dispose(): void {
    if (this.disposed) return;
    this.contextLost();
    this.entries.clear();
    this.disposed = true;
  }
}
