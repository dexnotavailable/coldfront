# Caldera wall material probe: obsidian hypothesis closed

**The three fixed wall samples do not support an obsidian-wall bug.** Every first occupied voxel is ordinary **Basalt, block 18**, with feature ID 0 and no fluid. The actual volcanic ground tag and four-metre skin mapping both agree with that hit. All three points lie inside caldera 4's wall band, and its low-ground obsidian condition is false at each point. No material correction or replacement-ray search is selected.

| Frozen PNG pixel | Hit voxel X/Y/Z | Continuous ground slope | Material |
|---|---|---:|---|
| 760,330 | 8522 / 92 / 1665 | 54.472° | Basalt 18 |
| 850,395 | 8500 / 64 / 1602 | 54.093° | Basalt 18 |
| 970,475 | 8504 / 51 / 1523 | 48.365° | Basalt 18 |

The lower sample's generic terrain material is Ash 29 before the volcanic ground mapping selects Basalt 18. That mapping is the expected production rule, not evidence of obsidian. The measured slope is the continuous column gradient; each voxel face remains axis-aligned.

The single root execution completes with exit 0 in **3.853 s** (worker 3.727 s), using one seed-1 WorldPlan, exactly three rays, 1,296 public voxel calls and six explicit provenance calls. No replacement sample, second plan, render or tuning follows. The supervisor records the exact child closing with no signal and empty stderr.

Source is clean `b8bac6af2bd6c0ad75bf3599bdc39a5f85eb259d`, generation `d3b3ba4…`. The frozen HELL-2 camera, FOV70, 1280×720 frame and pixel-centre convention match the saved capture. Independent static review checked the ray handedness, authoritative cleaned `cameraQuery(WorldContext)`/client DDA path and material semantics before execution.

These are bounded CPU first-hit observations, not a whole-wall census or GPU fragment/albedo readback. They do not isolate lighting, fog, texture filtering or the cause of the wall's final brightness. Nominal recipe colour and final PNG RGB remain separate measurements. The dark wall appearance does not justify relabelling the observed basalt as obsidian.

Private evidence:

- [Actual probe result](D:/Dex/Projects/coldfront/out/phase13/caldera-material-audit/probe/world-probe-result.json)
- [Supervisor exit/timing](D:/Dex/Projects/coldfront/out/phase13/caldera-material-audit/probe/supervisor-result.json)
- [Frozen inputs](D:/Dex/Projects/coldfront/out/phase13/caldera-material-audit/probe/frozen-input.json) and [independent review](D:/Dex/Projects/coldfront/out/phase13/caldera-material-audit/probe/independent-review/REVIEW.md)

The reviewer also opened the unchanged Normal and Clay originals named in the frozen input. The Normal view has a broad, low-contrast brown wall; Clay exposes its continuous slope, voxel rows and cast shadows more clearly. Clay changes the material, regional lighting and fog treatment, so it is not a prediction of a same-lighting material improvement.

A separate [source-grounded recommendation](D:/Dex/Projects/coldfront/out/phase13/caldera-material-audit/next-step.md) considers the missing ground-layer treatment. It proposes no implementation, palette/exposure change, new image or phase grade. The obsidian hypothesis is closed independently of that opportunity.
