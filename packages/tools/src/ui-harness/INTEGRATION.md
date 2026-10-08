# Isolated UI integration notes

This harness is a gallery, not a playable game. Only `sample.ts` contains its sample port, fixed readouts and generated preview icons. Real play must mount `GameUi` with `createUiController(realGamePort, realUiHost)`. The main composition root owns engine creation, verified fullscreen/keyboard-lock state and app-base URL resolution. The UI imports no Three.js.

Owned implementation paths: `packages/client/src/ui/**`, `packages/client/src/contracts/game-ui.ts`, `packages/tools/src/ui-strings/**`, `ui-lint/**`, `ui-shots/**`, `ui-harness/**`, `packages/tools/test/ui/**`.

Provisional files for coordinator reconciliation only: root `package.json` and `package-lock.json`; `packages/client/package.json`, `packages/client/tsconfig.json`; `packages/tools/package.json`, `packages/tools/tsconfig.json`. Never replace canonical manifests wholesale. No copied shared file belongs to this patch. The root-copied catalogue correction belongs to the coordinator, not this UI patch.

Exact additional npm dependencies and npm license metadata verified 8 October 2026: Preact 11.0.1 (MIT), @preact/signals 2.11.3 (MIT), preact-render-to-string 6.8.0 (MIT), Lucide 1.53.0 (ISC), @fontsource/inter 5.3.0 and @fontsource/cormorant-sc 5.3.0 (OFL-1.1), PostCSS 8.5.29 (MIT), Playwright 1.63.0 (Apache-2.0). Signals and render-to-string peer ranges explicitly include Preact 11. The coordinator must preserve upstream notices and add these to the canonical notices artifact.

CLI commands from repo root (package script proposals have the same purpose):

```text
node node_modules/tsx/dist/cli.mjs --tsconfig packages/tools/tsconfig.json packages/tools/src/ui-strings/index.ts
node node_modules/tsx/dist/cli.mjs --tsconfig packages/tools/tsconfig.json packages/tools/src/ui-lint/index.ts
node node_modules/tsx/dist/cli.mjs --tsconfig packages/tools/tsconfig.json packages/tools/src/ui-shots/index.ts
node node_modules/typescript/bin/tsc -p packages/client/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p packages/tools/tsconfig.json --noEmit
node node_modules/vitest/vitest.mjs run --config packages/tools/src/ui-harness/vitest.config.ts
```

`ui:shots --only fixture-a,fixture-b` is a bounded rerender route; `--screens` omits already verified primitives. `--strip <fixture>` captures a deterministic motion strip; `--sheet <comma-separated fixtures>` adds an HTML-image-grid contact sheet at `out/ui/_sheet-ui.jpg`. It starts and closes its own loopback server and one browser. It must be serialized with all other render/benchmark work. Browser selection is `CF_CHROMIUM`, then the proven Windows executable if present, then Playwright's default. TEMP/TMP/TMPDIR stay under `out/ui/temp`. The screenshot receipt retains dimensions, drawn words, visible IDs, isolation, layout failures and key traces. The audit callback has a test-only `__name` compatibility helper for tsx function-name serialization.

The primitive gate completed before game screen authoring: all nine corrected images opened with `view_image`; pass receipt `out/ui/shots-primitives-pass.json`. Prior failure `shots-primitives-initial.json` records exact tooltip wrapping caught at all three profiles. Coordinator decision100 corrected A2 to allow natural wrapping only in Tooltip while keeping exact strings, fs13 and width280. The browser audit proves a generic wrapping exemption cannot bypass the rule outside Tooltip.

The integrated build passes `ui:lint --complete`: real engine JPEG captures and source-bound evidence cover `hud.outline`, `hud.silhouette` and `hud.ghost`. No dummy SSR elements count for these rows. The separate bootstrap binding test checks all 22 catalogue bindings against the shell and engine registries. The gallery's fake port has no successful world capture method, so it cannot claim playable screenshot proof.
