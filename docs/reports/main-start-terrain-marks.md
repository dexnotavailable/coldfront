# Main-start terrain marks

The three sampled dark marks are exposed sides of ordinary grass blocks. Eight fixed pixel rays hit three vertical faces and five nearby horizontal tops, all inside the captured chunk set. This does not justify changing terrain geometry.

## Fixed-view comparison

At unchanged Main seed-1 spawn, four 1280 × 720 canvas captures compare Normal with Shadows on/off, Clay with Shadows off, and Features with Shadows off. Root and independent Astra open all four originals. The marks remain in Normal without shadows and in Clay; Features deliberately removes the lighting contrast. The three sampled dark pixels are byte-identical between Normal's shadow states.

Camera, avatar, world time, edits and the 111 requested/completed chunk headers remain identical. The first still freezes display time at zero; later captures retain it. The run finishes in **14.975 s**, with zero application errors, external requests or bad responses, four recorded ReadPixels warnings and successful browser/server cleanup.

## Voxel probe

The probe uses the recorded **40° field of view**, matching the production camera's pixel-centre projection. The postcard geometry helper assumes 70°, so it is not used here. One fresh seed-1 WorldPlan feeds the unchanged production point sampler and raycast.

| Pixel | First face | Voxel | Outside neighbour |
|---|---|---|---|
| (217, 185), small dark wedge | +X | Grass at (-16077, 35, -10439) | Air |
| (159, 88), wide dark strip | +X | Grass at (-16080, 35, -10444) | Air |
| (982, 34), upper-right dark wedge | −X | Grass at (-16052, 35, -10446) | Air |
| Five nearby controls | +Y | Grass | Air above |

All eight hits have feature ID zero. The probe finishes in **2.385 s**, including its fresh plan, with 544 caller lookups / 263 unique final voxel samples. Its caps remain eight rays, 128 m per ray, 500 DDA visits per ray and 5,000 lookups including the six neighbours of each hit. Independent review verifies the projection and agrees that the sampled forms are real risers.

## Production-worker face data

Two serial requests to the unchanged production worker generate, light and mesh the two hit chunks. All eight points match exactly one opaque quad with the expected block and normal. Every corner and every outside air cell has full skylight **15/15** and zero block light. The three dark side faces have AO tuples `[1,3,2,0]`, `[1,3,3,1]` and `[1,3,2,0]`, within the production 0–3 range. Both triangles of each quad are present.

The readback finishes in **3.280 s**, including the fresh plan; the two worker requests take 618.137 and 392.998 ms. These are bounded diagnostic timings, not a replacement benchmark or FPS measurement. No absent daylight, missing sampled face or malformed index range is found. The sampled Main-start diagnosis is closed without a source change.

## Scope and evidence

This is Main-start evidence, not a diagnosis of every dark mark in Ibara. CPU mesh values are not a complete GPU interpolation trace, and the images do not establish a new global lighting-quality score. No source fix, new formal HELL grade, phase completion or FPS improvement is claimed.

Study: `D:/Dex/Temp/coldfront-fleck-diagnosis-bbb83b6`, unchanged runtime source at `bbb83b6` / generation `676c1de…`.

- Four originals and post-cleanup receipt: `out/fleck-diagnosis/runs/2026-10-14T02-04-46.226Z-81a9f779/`.
- Independent image/helper review: `out/fleck-diagnosis/helper-review.md` and `.json`.
- Ray data: `out/fleck-diagnosis/trace-attempts/2026-10-14T02-13-40.103Z-55c04e7c/report.json`.
- Worker mesh/light data: `out/fleck-diagnosis/light-attempts/2026-10-14T02-24-38.227Z-bedef513/report.json`.
- Exact helpers and execution logs remain alongside these outputs; prior source hypotheses remain preserved.
