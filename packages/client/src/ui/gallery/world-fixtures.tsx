/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { t } from "../t";
import type { GalleryFixture } from "./registry";
import { worldEvidence } from "./world-evidence";
export const worldFixtures: readonly GalleryFixture[] = worldEvidence.cases.map(
  (evidence) => ({
    id: evidence.id,
    kind: "screen",
    sampleContent: [],
    render: () => (
      <figure class="gallery-world-evidence" data-world-evidence={evidence.id}>
        <img
          src={`${import.meta.env?.BASE_URL ?? "/"}${evidence.image}`}
          alt={t(evidence.rows[0] ?? "hud.outline")}
        />
      </figure>
    ),
  }),
);
