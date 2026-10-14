import type { WorldIdentity } from "./types.js";

export type GenerationVariant = "production" | "primitive";
const PRIMITIVE_SUFFIX = ":primitive-v1";

/** Production keys remain byte-for-byte compatible with existing saves. */
export function generationKey(
  version: number,
  sourceHash: string,
  variant: GenerationVariant = "production",
): string {
  if (variant !== "production" && variant !== "primitive")
    throw new Error("Unknown generation variant");
  return `${version}:${sourceHash}${variant === "primitive" ? PRIMITIVE_SUFFIX : ""}`;
}

/** The generation namespace is the sole authority, including worker hydration. */
export function generationVariant(identity: WorldIdentity): GenerationVariant {
  if (!identity.generation.endsWith(PRIMITIVE_SUFFIX)) return "production";
  if (identity.kind !== "main")
    throw new Error("Primitive generation requires a main world");
  return "primitive";
}
