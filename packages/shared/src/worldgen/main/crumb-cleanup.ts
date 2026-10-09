import { CHUNK_SIZE, CHUNK_VOLUME } from "../../world/constants.js";
import type { LayerId, RegionId } from "../../world/types.js";

export interface FloatingFeatureOwner {
  readonly region: RegionId;
  readonly layer: LayerId;
  readonly featureId: number;
}
/** Current main generation has no authorised floating feature owners. Future
 * Isles islands, Hoshikuzu shards and Hollow Sky ceilings must opt in by their
 * actual owner here; region membership by itself must never exempt noise. */
export function allowsMainFloatingFeature(
  _owner: FloatingFeatureOwner,
): boolean {
  return false;
}

/** LOD0 generation only. Deliberate floaters need actual region/layer/feature
 * ownership, not a blanket exemption for noise within an eligible region. */
export interface CrumbField {
  /** Raw, fully composed/carved registry solidity at the unit-cell centre.
   * Must not call a cleaned sampler, or depend on the caller's feature batch. */
  rawSolidAt(ix: number, iy: number, iz: number): boolean;
  allowsFloating(ix: number, iy: number, iz: number): boolean;
  /** Optional proof: this column is solid from the canonical owner's bottom
   * layer up to (strictly below) this height. A guessed surface is insufficient. */
  provenSolidBelow?(ix: number, iz: number): number;
}
export interface CrumbStats {
  readonly ownerChunks: number;
  readonly ownerChunkLimit: number;
  readonly flagBufferBytes: number;
  readonly searchBufferBytes: number;
  readonly searches: number;
  readonly rawQueries: number;
  readonly maxSearchDiscoveries: number;
}
export interface CrumbCleanup {
  removed(ix: number, iy: number, iz: number): boolean;
  statistics(): CrumbStats;
}
const UNKNOWN = 0;
const AIR = 1;
const PENDING = 2;
const RETAINED = 3;
const REMOVED = 4;
const MIN_COMPONENT = 64;
export const CRUMB_OWNER_LIMIT = 16;

/** Six-connected, bounded classification in the voxel's canonical 32³ owner.
 * Every discovered voxel is connected to the start. Reaching 64, an exemption,
 * a retained member, or ANY outermost layer proves retention for that search.
 * Only an exhausted closed component can be removed. Boundary floaters survive
 * intentionally; this is not a global connectivity guarantee. Cache eviction
 * changes work, never answers. One synchronous search uses a 128-byte queue. */
export function createCrumbCleanup(
  field: CrumbField,
  ownerChunkLimit = CRUMB_OWNER_LIMIT,
): CrumbCleanup {
  if (!Number.isInteger(ownerChunkLimit) || ownerChunkLimit < 1)
    throw new RangeError("Invalid crumb owner cache limit");
  const owners = new Map<string, Uint8Array>();
  const queue = new Uint16Array(MIN_COMPONENT);
  let searches = 0,
    rawQueries = 0,
    maxSearchDiscoveries = 0;
  return {
    removed(ix, iy, iz) {
      if (![ix, iy, iz].every(Number.isSafeInteger))
        throw new RangeError("Crumb addresses must be safe integers");
      const ox = Math.floor(ix / CHUNK_SIZE) * CHUNK_SIZE;
      const oy = Math.floor(iy / CHUNK_SIZE) * CHUNK_SIZE;
      const oz = Math.floor(iz / CHUNK_SIZE) * CHUNK_SIZE;
      const localX = ix - ox,
        localY = iy - oy,
        localZ = iz - oz;
      // A directly queried boundary solid is retained; boundary air is never
      // removed either. Neither answer needs a cache entry or a raw query.
      // Interior searches still establish solidity before retaining a boundary
      // neighbour: touching boundary AIR is not a connectivity witness.
      if (
        localX === 0 ||
        localX === 31 ||
        localY === 0 ||
        localY === 31 ||
        localZ === 0 ||
        localZ === 31
      )
        return false;
      const key = `${ox},${oy},${oz}`;
      let flags = owners.get(key);
      if (flags) owners.delete(key);
      else flags = new Uint8Array(CHUNK_VOLUME);
      owners.set(key, flags);
      if (owners.size > ownerChunkLimit) {
        const oldest = owners.keys().next().value;
        if (oldest !== undefined) owners.delete(oldest);
      }
      const start = localX + CHUNK_SIZE * (localY + CHUNK_SIZE * localZ);
      if (flags[start] !== UNKNOWN) return flags[start] === REMOVED;
      let count = 0,
        retained = false;
      // Index order is fixed: x, y, z, with negative then positive neighbours.
      const visit = (x: number, y: number, z: number): void => {
        const index = x + CHUNK_SIZE * (y + CHUNK_SIZE * z);
        const known = flags[index];
        if (known === RETAINED) {
          retained = true;
          return;
        }
        if (known === AIR || known === PENDING) return;
        // A completed removed component cannot neighbour an undiscovered solid:
        // its exhaustive search would already have labelled that neighbour.
        // The same existing all-solid column proof can establish both solidity
        // and a path to the owner's bottom before evaluating any raw geometry.
        // False/absent proofs keep the original raw path, including exact-bound
        // centres. Future subtractive carvers must replace or disable this proof.
        const proven =
          oy + y + 0.5 <
          (field.provenSolidBelow?.(ox + x, oz + z) ?? -Infinity);
        if (!proven) {
          rawQueries++;
          if (!field.rawSolidAt(ox + x, oy + y, oz + z)) {
            flags[index] = AIR;
            return;
          }
        }
        queue[count++] = index;
        flags[index] = PENDING;
        retained =
          count === MIN_COMPONENT ||
          x === 0 ||
          x === 31 ||
          y === 0 ||
          y === 31 ||
          z === 0 ||
          z === 31 ||
          proven ||
          field.allowsFloating(ox + x, oy + y, oz + z);
      };
      searches++;
      try {
        visit(localX, localY, localZ);
        for (let head = 0; head < count && !retained; head++) {
          const index = Number(queue[head]);
          const x = index % CHUNK_SIZE;
          const y = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
          const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
          // An outer-layer discovery stops before it is expanded; all of these
          // neighbours therefore remain inside this owner, including negatives.
          visit(x - 1, y, z);
          if (!retained) visit(x + 1, y, z);
          if (!retained) visit(x, y - 1, z);
          if (!retained) visit(x, y + 1, z);
          if (!retained) visit(x, y, z - 1);
          if (!retained) visit(x, y, z + 1);
        }
      } catch (error) {
        // Never let an interrupted search turn into a completed cache answer.
        for (let i = 0; i < count; i++) flags[Number(queue[i])] = UNKNOWN;
        throw error;
      }
      maxSearchDiscoveries = Math.max(maxSearchDiscoveries, count);
      for (let i = 0; i < count; i++)
        flags[Number(queue[i])] = retained ? RETAINED : REMOVED;
      return count > 0 && !retained;
    },
    statistics: () => ({
      ownerChunks: owners.size,
      ownerChunkLimit,
      flagBufferBytes:
        owners.size * CHUNK_VOLUME * Uint8Array.BYTES_PER_ELEMENT,
      searchBufferBytes: queue.byteLength,
      searches,
      rawQueries,
      maxSearchDiscoveries,
    }),
  };
}
