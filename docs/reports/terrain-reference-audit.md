# Terrain references and the underground plan

9 October 2026. An Astra terrain lane compared seven primary project pages and opened twenty official reference images. This is a visual and design audit: no mods were installed, no mod source or data was inspected, and no code or assets were brought into COLDFRONT. The owner's explicit request permits this bounded public-reference research; the source restrictions in `10-prior-art.md` remain intact. Gallery images sometimes predate current releases. Stills cannot prove connectivity, generation speed or frame rate.

There is no single demonstrated “best” generator here. These references are useful for different parts of COLDFRONT:

| Reference | Useful evidence and lesson | Application and limit |
|---|---|---|
| [Big Globe](https://modrinth.com/mod/big-globe) | Monumental mountain relief, layered cave walls and a strong increase in scale with depth. The project describes a 2048-block Overworld and its own LOD. | Kurogane, Great Shear and the Pit. Preserve readable terraces; the near-continuous orange of the core reference would overwhelm our travel cues. Reference only; no source inspected. |
| [Tectonic](https://modrinth.com/datapack/tectonic) | Continuous ranges and valleys, tall jungle pillars, underground rivers continuing surface drainage. | Kurogane valleys, Selva karst and rare deliberately owned river passages. A pictured passage does not establish navigability; Kaldmark keeps its ring and funnel. |
| [Alex's Caves](https://modrinth.com/mod/alexs-caves) | Six destination cave biomes with individual lighting and atmosphere. Opened images show root-crossed spaces, directional mineral masses and selective underwater focal points. | Different floor, roof and pillar shapes for Root Halls, Sporewood, Kagami and Drowned Caverns. Avoid dark floors that disappear from the Overhead camera. |
| [YUNG's Better Caves](https://modrinth.com/mod/yungs-better-caves) | Modest entrances opening into larger halls, terraces and mixed dry/fluid spaces. Current listings include modern releases; treating it as only a legacy 1.16 mod is inaccurate. | Controlled crust mouths and Upper Deep chambers. Test actual connectivity and fluid ownership ourselves. |
| [Terralith](https://modrinth.com/datapack/terralith) | Composed calderas, irregular rims, radial erosion, stepped pools and mineral bands. | Give Ibara a hierarchy of landmarks and place materials according to geology. Extra biome count is not a goal; reference pictures include rendering effects. |
| [Nullscape](https://www.stardustlabs.net/nullscape) | Large deliberate gaps, stacked islands, arches and perforated masses in a 384-block vertical span. | Sundered Isles and carefully bounded Hollow Sky features. Reject thin necks, disconnected crumbs and violations of sealed rock/shelves. |
| [Incendium](https://www.stardustlabs.net/incendium) | Inverted forests and ceiling features make the whole volume participate in hostile scenery. | Hollow Sky ceilings and Deep Forges light hierarchy. The official gallery is older, the current listing is titled Legacy, and its bloom/particles are not suitable as our readability standard. |

## Fit to Kaldmark

The following are design inferences from those references and the existing world specification. They do not change the world's footprint, layer depths or named descents.

| Zone | What remains fixed | What to build and prove |
|---|---|---|
| Surface and crust, down to −48 m | Controlled cave mouths, near-surface cover, owned drainage and settlement space | Quiet mouths opening into large interiors; coherent ridges and valleys; rare feature-owned river tunnels. Inspect matched mouth/interior views and audit every fluid breach. |
| Upper Deep, −48 to −368 m; radius 6.5–16.5 km | Eight regions, sealed central rock, cover beneath surface water | Region-specific chamber floors, roofs, pillars and connectors. Root halls, broad fungal rooms and geodes must differ in shape. Map route opportunities from approved descents, including climb, flood, construction and gate constraints. |
| Undercrown, −400 to −720 m; radius 3.5–11.5 km | Buried City, 4–6 km Hollow Sky void, Leyflow and Great Shear | Civic terraces, deliberately enormous voids and ceiling masses. Reserve extreme openness for named regions. Slices and LOD tests must retain the roof, islands, floor and intervening gaps. |
| Maw, −752 to −1072 m; radius 2–7 km | Named entrances and separate fluid owners | Contrast Gut's 10–30 m ribbed tubes, Deep Forges' 100–300 m halls and Yomi's sparse ash vistas. Route tests must not invent passages around defended entrances. |
| Pit, −1104 to −1504 m; radius up to 2.2 km | Roughly 4 km bowl, terraces, Wellspring, three Throats and the Stair | One strong focal centre with legible approach terraces and restrained light. No indiscriminate lava ocean or porous noise field. |
| Three 32 m shelves | Solid −368…−400, −720…−752 and −1072…−1104 m bands, except authorised descents | Apply the solid masks after generic cave carving. Every exception must identify its descent. Census holes and inspect perpendicular slices through exceptional routes. |

“Connected” must not mean pre-flattened or freely walkable. The route-opportunity graph records where players can walk, climb, cross water, build a bridge/lift, or confront a gate. It preserves terrain and construction as gameplay instead of smoothing away the problem.

## Implementation order and acceptance

1. Finish one Ibara cluster and one grounded landmark at one-metre resolution. Review clay, material, close and normal Overhead views before increasing coverage. The first twelve actual asset views already received an independent critique; irregular bases, small-thorn readability and arch asymmetry are the next bounded repairs.
2. Establish layer masks, shelves, named descent envelopes, owned fluids and water-bed cover before cave decoration. Prove them in the atlas and slices.
3. Build one natural Upper Deep chamber and connector, then a deliberately different region's chamber. Check route opportunities and actual cut-view readability.
4. Expand in roadmap order, keeping giant voids and floating forms within their named regions. Add materials and atmosphere after silhouettes and routes work.
5. Review seeds 1–3 against the existing postcard bars with fresh critics; benchmark generation, lighting and meshing separately. Reference images are not performance evidence.

Private provenance is retained in the terrain lane's `out/ibara/research/`: project metadata, dated release context, twenty image URLs and hashes, and the structured audit. Those external reference images are not game assets and are not committed.
