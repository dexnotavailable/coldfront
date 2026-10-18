import type { WorldIdentity } from "../../../shared/src/world/types.js";
import { validIdentity } from "./world-save.js";

/** One evidence-approved, one-way pair. No release is enabled by this module. */
export interface ApprovedSaveMigration {
  readonly fromGeneration: string;
  readonly toGeneration: string;
}

const PRODUCTION_V4 = /^4:[a-f0-9]{64}$/;

/** Saves alone may cross this exact pair; world/cache/postcard identity cannot. */
export function previousSaveIdentity(
  identity: WorldIdentity,
  currentGeneration: string,
  migration: ApprovedSaveMigration | undefined,
): WorldIdentity | null {
  if (!migration) return null;
  if (
    !PRODUCTION_V4.test(migration.fromGeneration) ||
    !PRODUCTION_V4.test(migration.toGeneration) ||
    migration.fromGeneration === migration.toGeneration
  )
    throw new Error("Save migration requires one distinct version-4 hash pair");
  if (!validIdentity(identity)) throw new Error("Invalid world identity");
  if (
    currentGeneration !== migration.toGeneration ||
    identity.generation !== migration.toGeneration
  )
    return null;
  return { ...identity, generation: migration.fromGeneration };
}
