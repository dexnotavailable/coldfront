/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { createElement } from "preact";
import { useEffect } from "preact/hooks";
import { type CatalogueId, catalogue, currentId, t } from "../t";
import { type GalleryFixture, galleryFixtures } from "./registry";

declare global {
  interface Window {
    __cfUi: {
      fixture: string;
      ready: boolean;
      closeable: boolean;
      closed: boolean;
      ids: string[];
    };
  }
}
export function FixtureView({
  fixture,
  scale = 1,
  freezeMotion = false,
}: {
  fixture: GalleryFixture;
  scale?: number;
  freezeMotion?: boolean;
}) {
  useEffect(() => {
    window.__cfUi = {
      fixture: fixture.id,
      ready: true,
      closeable: fixture.closeable ?? false,
      closed: false,
      ids: Object.keys(catalogue).filter(currentId),
    };
  }, [fixture]);
  return (
    <main
      id="gallery-stage"
      data-fixture={fixture.id}
      data-motion-freeze={freezeMotion}
      style={{
        zoom: scale,
        width: `${100 / scale}vw`,
        height: `${100 / scale}vh`,
      }}
    >
      {createElement(fixture.render, {})}
    </main>
  );
}
export function Gallery() {
  const query = new URLSearchParams(location.search);
  const fixture = galleryFixtures.find(
    (item) => item.id === query.get("state"),
  );
  const scale = query.get("scale") === "1.5" ? 1.5 : 1;
  if (fixture)
    return (
      <FixtureView
        fixture={fixture}
        scale={scale}
        freezeMotion={query.has("motion")}
      />
    );
  return (
    <nav class="gallery-index" data-gallery-index>
      {galleryFixtures.map((item) => (
        <a key={item.id} href={`?gallery&state=${item.id}`}>
          {item.id}
        </a>
      ))}
    </nav>
  );
}
/** Separate helper for external browser evidence; rejects future/unknown labels. */
export function expectedCatalogueText(id: string): string {
  if (!currentId(id)) throw new Error(`Unknown current ID: ${id}`);
  return t(id as CatalogueId);
}
