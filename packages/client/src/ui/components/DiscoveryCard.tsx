/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { ContentText } from "./Text";

/** Presentation only. Region entry and persisted discovery belong to the game. */
export interface DiscoveryContent {
  readonly id: string;
  readonly name: string;
  readonly kanji?: string;
  readonly sentence: string;
}
export function DiscoveryCard({ content }: { content: DiscoveryContent }) {
  return (
    <div class="cf-card cf-discovery" data-discovery={content.id}>
      {content.kanji && (
        <div class="cf-discovery-kanji">
          <ContentText value={content.kanji} />
        </div>
      )}
      <div class="cf-discovery-name">
        <ContentText value={content.name} />
      </div>
      <div class="cf-discovery-story">
        <ContentText value={content.sentence} />
      </div>
    </div>
  );
}
