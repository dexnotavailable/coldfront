import {
  Color,
  DataArrayTexture,
  type DepthTexture,
  type IUniform,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  NearestFilter,
  type Plane,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { generateTextureArray } from "../../../shared/src/blocks/textures/recipes.js";

export type TerrainViewMode = "normal" | "clay" | "features";
export const TERRAIN_VIEW_MODES = { normal: 0, clay: 1, features: 2 } as const;
// Bound reflected light before adding authored HDR sources. Even white terrain
// under full sky, RGB spill and gloss cannot enter the bloom extraction pass.
export const TERRAIN_BLOOM_THRESHOLD = 2;
export const TERRAIN_REFLECTED_CEILING = 1.5;
export const TERRAIN_EMISSION_SCALE = 8;
// Red-dominant ember seams need exposure by luminance, not just a red channel
// above threshold. Keep their authored hue/mask and steady propagated RGB intact.
export const TERRAIN_EMBER_EMISSION_GAIN = 4;

export interface TerrainUniforms {
  readonly viewMode: IUniform<number>;
  readonly tiles: IUniform<DataArrayTexture>;
  readonly cut: IUniform<number>;
  readonly display: IUniform<number>;
  readonly night: IUniform<number>;
  readonly origin: IUniform<Vector3>;
  readonly pop: IUniform<Vector3>;
  readonly popActive: IUniform<number>;
  readonly pixelScale: IUniform<number>;
  readonly waterDepth: IUniform<DepthTexture | null>;
  readonly waterDepthSize: IUniform<Vector2>;
  readonly waterDepthLinearize: IUniform<Vector2>;
  readonly waterDepthReady: IUniform<number>;
}
/** Positive view distance =1/(x+depth*y), matching a perspective depth buffer. */
export function waterDepthRange(
  near: number,
  far: number,
  out: Vector2,
): Vector2 {
  if (
    !Number.isFinite(near) ||
    !Number.isFinite(far) ||
    near <= 0 ||
    far <= near
  )
    throw new RangeError("Invalid water depth camera range");
  return out.set(1 / near, 1 / far - 1 / near);
}
export function createTerrainMaterials(clip: Plane): {
  materials: MeshLambertMaterial[];
  uniforms: TerrainUniforms;
  texture: DataArrayTexture;
} {
  const pixels = generateTextureArray(),
    texture = new DataArrayTexture(
      pixels.data,
      pixels.width,
      pixels.height,
      pixels.layers,
    );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const uniforms: TerrainUniforms = {
    viewMode: { value: 0 },
    tiles: { value: texture },
    cut: { value: 100000 },
    display: { value: 0 },
    night: { value: 0 },
    origin: { value: new Vector3() },
    pop: { value: new Vector3() },
    popActive: { value: 0 },
    pixelScale: { value: 0.00035 },
    waterDepth: { value: null },
    waterDepthSize: { value: new Vector2(1, 1) },
    waterDepthLinearize: { value: new Vector2() },
    waterDepthReady: { value: 0 },
  };
  const emission = {
    value: BLOCK_REGISTRY.map(
      (block) =>
        new Vector4(
          ...block.emission.map((n) => n / 15),
          block.emissionStrength,
        ),
    ),
  };
  const gloss = { value: BLOCK_REGISTRY.map((block) => block.gloss) };
  const materials = [0, 1, 2, 3, 4].map((kind) => {
    const material = new MeshLambertMaterial({
      color: new Color(1, 1, 1),
      alphaTest: kind === 1 ? 0.5 : 0,
      transparent: kind === 2 || kind === 3,
      opacity: kind === 3 ? 0.76 : 1,
      depthWrite: kind < 2 || kind === 4,
      clippingPlanes: [clip],
      clipShadows: true,
    });
    material.customProgramCacheKey = () =>
      `coldfront-terrain-r186-v3-ibara-class-${kind}`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uViewMode: uniforms.viewMode,
        uEmission: emission,
        uGloss: gloss,
        uTiles: uniforms.tiles,
        uCut: uniforms.cut,
        uDisplay: uniforms.display,
        uNight: uniforms.night,
        uRenderOrigin: uniforms.origin,
        uPop: uniforms.pop,
        uPopActive: uniforms.popActive,
        uPixelScale: uniforms.pixelScale,
        uWaterDepth: uniforms.waterDepth,
        uWaterDepthSize: uniforms.waterDepthSize,
        uWaterDepthLinearize: uniforms.waterDepthLinearize,
        uWaterDepthReady: uniforms.waterDepthReady,
      });
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
attribute float aPackedPosition;
attribute vec3 aSurface;
attribute vec3 aExpand;
attribute vec2 aFeatureIdParts;
flat varying highp vec2 vFeatureIdParts;
uniform float uPixelScale;
varying vec3 vVoxelWorld;
varying vec3 vVoxelNormal;
varying vec3 vSurface;
uniform vec3 uRenderOrigin;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
float px = mod(aPackedPosition,64.0);
float py = mod(floor(aPackedPosition/64.0),64.0);
float pz = floor(aPackedPosition/4096.0);
vec3 transformed = vec3(px,py,pz);
vVoxelWorld = (modelMatrix * vec4(transformed,1.0)).xyz - uRenderOrigin;
vVoxelNormal = normal;
vSurface = aSurface;
vFeatureIdParts = aFeatureIdParts;
${kind < 2 ? "transformed += aExpand * abs((modelViewMatrix * vec4(transformed,1.0)).z) * uPixelScale;" : ""}
`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
precision highp sampler2DArray;
precision highp int;
uniform float uViewMode;
uniform vec4 uEmission[${BLOCK_REGISTRY.length}];
uniform float uGloss[${BLOCK_REGISTRY.length}];
flat varying highp vec2 vFeatureIdParts;
uniform sampler2DArray uTiles;
uniform float uCut;
uniform float uDisplay;
uniform float uNight;
uniform sampler2D uWaterDepth;
uniform vec2 uWaterDepthSize;
uniform vec2 uWaterDepthLinearize;
uniform float uWaterDepthReady;
uniform vec3 uRenderOrigin;
varying vec3 vVoxelWorld;
varying vec3 vVoxelNormal;
varying vec3 vSurface;
uniform vec3 uPop;
uniform float uPopActive;
highp uint cfFeatureId() {
  return uint(vFeatureIdParts.x) | (uint(vFeatureIdParts.y) << 16u);
}
vec3 cfFeatureColour(highp uint id) {
  if(id == 0u) return vec3(0.32);
  highp uint h = id;
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
  return vec3(0.12) + vec3(float(h&255u),float((h>>8u)&255u),float((h>>16u)&255u))*(0.66/255.0);
}
uint cfHash(ivec3 cell) {
  uint h = uint(cell.x)*0x9e3779b1u ^ uint(cell.y)*0x85ebca77u ^ uint(cell.z)*0xc2b2ae3du;
  h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; return h ^ (h >> 16u);
}
float cfMacro(vec2 p) {
  vec2 q = floor(p), f = fract(p); f=f*f*(3.0-2.0*f);
  float a=float(cfHash(ivec3(int(q.x),0,int(q.y)))&255u)/255.0;
  float b=float(cfHash(ivec3(int(q.x)+1,0,int(q.y)))&255u)/255.0;
  float c=float(cfHash(ivec3(int(q.x),0,int(q.y)+1))&255u)/255.0;
  float d=float(cfHash(ivec3(int(q.x)+1,0,int(q.y)+1))&255u)/255.0;
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
// Slow cellular plates. Only the luminous cracks move; the fluid surface and
// its occlusion remain the exact meshed voxel boundary.
float cfLavaCracks(vec2 world, float seconds) {
  vec2 p=world*0.62 + vec2(seconds*0.018,seconds*0.011);
  p += vec2(cfMacro(world/7.0),cfMacro(world/7.0+17.0))*0.38;
  vec2 base=floor(p), local=fract(p);
  float nearest=10.0, nextNearest=10.0;
  for(int z=-1;z<=1;z++) for(int x=-1;x<=1;x++) {
    ivec3 key=ivec3(ivec2(base)+ivec2(x,z),7);
    uint h=cfHash(key);
    vec2 jitter=vec2(float(h&255u),float((h>>8u)&255u))/255.0;
    float d=length(vec2(x,z)+0.2+jitter*0.6-local);
    if(d<nearest) { nextNearest=nearest; nearest=d; }
    else nextNearest=min(nextNearest,d);
  }
  return 1.0-smoothstep(0.025,0.14,nextNearest-nearest);
}`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
vec3 absoluteWorld = vVoxelWorld + uRenderOrigin;
ivec3 cell = ivec3(floor(absoluteWorld - vVoxelNormal*0.001));
if(uPopActive>0.5 && all(equal(cell,ivec3(uPop)))) discard;
uint hash = cfHash(cell);
float block = floor(vSurface.x+0.5);
if(block == 4.0 && vVoxelNormal.y < -0.5) block=3.0;
float layer = block*6.0 + (vVoxelNormal.y > 0.5 ? 3.0 : 0.0) + float(hash%3u);
vec2 tiled = abs(vVoxelNormal.y)>0.5 ? absoluteWorld.xz : abs(vVoxelNormal.x)>0.5 ? absoluteWorld.zy : absoluteWorld.xy;
// Variant rotation belongs to the shader, never to the greedy merge key.
if((hash & 4u)!=0u) tiled.x=-tiled.x;
vec4 texel = texture(uTiles,vec3(fract(tiled),layer));
float micro=0.94+float((hash>>5u)&255u)/255.0*0.12;
float macro=0.88+cfMacro(absoluteWorld.xz/128.0)*0.24;
vec3 hue=vec3(1.0+float((hash>>13u)&31u)/31.0*0.06-0.03,1.0,1.0-float((hash>>13u)&31u)/31.0*0.06+0.03);
diffuseColor *= vec4(uViewMode>0.5 ? vec3(0.48) : texel.rgb*micro*macro*hue, texel.a);
if(uViewMode>0.5) diffuseColor.a=texel.a;
${
  kind === 3
    ? `
// Keep thin/shallow water transparent. Deep water absorbs the background rather
// than exposing the bright sky where the bed lies beyond the loaded near field.
if(uWaterDepthReady>0.5) {
  float opaqueDepth=texture2D(uWaterDepth,gl_FragCoord.xy/uWaterDepthSize).x;
  float opaqueDistance=1.0/dot(vec2(1.0,opaqueDepth),uWaterDepthLinearize);
  float waterPath=max(0.0,opaqueDistance-vViewPosition.z)*length(vViewPosition)/max(vViewPosition.z,0.0001);
  diffuseColor.a=1.0-(1.0-diffuseColor.a)*exp(-waterPath*0.08);
}`
    : ""
}
`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `
highp uint packedLight=uint(floor(vSurface.z+0.5));
float sky=float((packedLight>>12u)&15u)/15.0;
vec3 blockLight=vec3(float((packedLight>>8u)&15u),float((packedLight>>4u)&15u),float(packedLight&15u))/15.0;
float ao=0.48+vSurface.y/3.0*0.52;
float survey = uCut < 99999.0 ? 0.42 : 0.0;
outgoingLight *= max(0.13+sky*0.87,survey)*ao;
outgoingLight += diffuseColor.rgb * survey * 0.38;
if(uViewMode<0.5) {
  // Propagated RGB is reflected light, independent of source emission and sky.
  outgoingLight += diffuseColor.rgb * blockLight*blockLight * (2.4*ao);
  float gloss=uGloss[int(block)];
  vec3 eye=normalize(cameraPosition-uRenderOrigin-vVoxelWorld);
  vec3 reflected=reflect(-eye,normalize(vVoxelNormal));
  vec3 skyReflection=mix(vec3(0.22,0.27,0.34),vec3(0.43,0.57,0.7),smoothstep(-0.12,0.55,reflected.y));
  skyReflection=mix(skyReflection,skyReflection*vec3(0.16,0.22,0.34),uNight);
  float fresnel=0.08+0.92*pow(1.0-max(0.0,dot(eye,normalize(vVoxelNormal))),5.0);
  outgoingLight += skyReflection*gloss*fresnel*sky*ao;
  ${kind === 3 ? "float ripple=sin(absoluteWorld.x*1.2+uDisplay*0.001)*sin(absoluteWorld.z*0.9-uDisplay*0.0007); outgoingLight *= 0.96 + ripple*0.04;" : ""}
  outgoingLight=min(outgoingLight,vec3(${TERRAIN_REFLECTED_CEILING.toFixed(1)}));
  vec4 source=uEmission[int(block)];
  if(source.a>0.0) {
    float phase=float(cfHash(cell)&1023u)*0.006135923;
    float breath=1.0+0.1*sin(uDisplay*0.0011+phase);
    ${
      kind === 4
        ? `float cracks=cfLavaCracks(tiled,uDisplay*0.001);
    outgoingLight *= mix(0.38,0.9,cracks);
    float sourceMask=cracks;`
        : `// P3 marks hot seams by red excess; cool dark crust stays unlit.
    float sourceMask=smoothstep(0.05,0.22,texel.r-max(texel.g,texel.b));`
    }
    // Shape the registry hue before HDR scaling so hot cracks retain colour
    // through ACES. This is presentation only; source light remains unchanged.
    float renderGain=block==${Block.EmberCrust.toFixed(1)} ? ${TERRAIN_EMBER_EMISSION_GAIN.toFixed(1)} : 1.0;
    outgoingLight += pow(source.rgb,vec3(2.2))*source.a*${TERRAIN_EMISSION_SCALE.toFixed(1)}*renderGain*sourceMask*breath;
  }
} else if(uViewMode<1.5) {
  outgoingLight=vec3(dot(outgoingLight,vec3(0.2126,0.7152,0.0722)));
  outgoingLight=min(outgoingLight,vec3(${TERRAIN_REFLECTED_CEILING.toFixed(1)}));
} else {
  outgoingLight=cfFeatureColour(cfFeatureId());
}
#include <opaque_fragment>`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `
#ifdef USE_FOG
if(uViewMode<0.5) {
float distanceFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
float heightFog=1.0-exp(-vFogDepth*fogDensity*0.25*exp(-max(absoluteWorld.y,0.0)*0.025));
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(max(distanceFog,heightFog),0.0,1.0));
}
#endif`,
      );
    };
    return material;
  });
  return { materials, uniforms, texture };
}
