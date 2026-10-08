# Third-party notices

## FastNoiseLite (MIT)

Ported gradient tables and OpenSimplex2 lattice/hash kernels:
packages/shared/src/noise/gradients.ts, opensimplex2.ts and opensimplex2s.ts.
Analytic derivatives and Hessians are original derivations of those kernels.

Source revision: 785f37a9ad76e283586a379675085f2063ae03f7.
Source: https://github.com/Auburn/FastNoiseLite/blob/785f37a9ad76e283586a379675085f2063ae03f7/JavaScript/src/FastNoiseLite.ts
Licence: https://github.com/Auburn/FastNoiseLite/blob/785f37a9ad76e283586a379675085f2063ae03f7/LICENSE

The TypeScript source notice is preserved in all three ported files:

// MIT License
//
// Copyright(c) 2023 Jordan Peck (jordan.me2@gmail.com)
// Copyright(c) 2023 Contributors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions :
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

The repository root licence is also preserved below:

MIT License

Copyright(c) 2020 Jordan Peck (jordan.me2@gmail.com)
Copyright(c) 2020 Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
## npm development tools

TypeScript: Apache-2.0. Vitest, Vite, tsx and Node type declarations: MIT. Biome: MIT OR Apache-2.0.
These tools are development dependencies; shared has no runtime dependencies.
Their complete package notices remain in their npm distributions.

## binary-greedy-meshing v1 (MIT)

The bitwise meshing and ambient-occlusion kernel in `packages/shared/src/meshing/greedy.ts` is ported from cgerikj/binary-greedy-meshing revision `f88305d0a027ca4bb6cd44b10322b87f4a98e912` (v1.0.0).

Source: https://github.com/cgerikj/binary-greedy-meshing/tree/f88305d0a027ca4bb6cd44b10322b87f4a98e912

Copyright (c) 2020 Erik Johansson

The MIT permission and warranty terms reproduced above also apply to this port. The complete original notice is retained in `packages/shared/src/meshing/LICENSE.binary-greedy-meshing`.

Adaptations use unsigned 32-bit masks with separate neighbour border bits, ordered AO/light merge keys, typed mesh buffers and pixel-sized quad expansion. The port header identifies these changes.

## Voxelize lighting (MIT)

The lighting queues in `packages/shared/src/lighting/flood.ts` are ported from voxelize/voxelize revision `b5097e45acba0b5e4c457eb7c4294a6797b2b485`.

Source: https://github.com/voxelize/voxelize/tree/b5097e45acba0b5e4c457eb7c4294a6797b2b485

Copyright (c) 2022 Shaoru Ian Huang.

The MIT permission and warranty terms reproduced above also apply to this port. The complete original notice is retained in `packages/shared/src/lighting/LICENSE.voxelize`.

Adaptations use bounded typed arrays, packed sky/RGB channels, heightmap seeding, removal/refill queues and live-seed filtering. Timers and browser/world-object dependencies are not part of the shared port.

## Bundled client dependencies

- three.js 0.186.0: MIT; Copyright © 2010–2026 three.js authors. Used unmodified for WebGL rendering, materials, SunLight and Sky.
- postprocessing 6.39.5: Zlib; Copyright © 2015 Raoul van Rüschen. Used unmodified for the composer, bloom and tone mapping.
- Preact 11.0.1, @preact/signals 2.11.3 and their installed runtime dependencies: MIT.
- Lucide 1.53.0: ISC.
- Inter and Cormorant SC from @fontsource 5.3.0 packages: SIL Open Font License 1.1. Font files are bundled locally and unmodified.

The production build collects the complete notices from the installed runtime packages, including transitive dependencies, into `/licenses/`. The menu's Licences action opens that collection. Any MPL source added later is copied separately with its original header.

## Screenshot and interface development tools

Playwright 1.63.0 is Apache-2.0; PostCSS 8.5.29 and preact-render-to-string 6.8.0 are MIT. Sharp 0.35.5 is Apache-2.0 and retains its bundled libvips notices. These are development/capture tools, not runtime network dependencies or game assets. Their complete notices remain in their npm distributions.
