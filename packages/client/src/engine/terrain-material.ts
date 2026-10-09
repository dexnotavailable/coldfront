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
} from "three";
import { generateTextureArray } from "../../../shared/src/blocks/textures/recipes.js";

export interface TerrainUniforms {
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
  const materials = [0, 1, 2, 3].map((kind) => {
    const material = new MeshLambertMaterial({
      color: new Color(1, 1, 1),
      alphaTest: kind === 1 ? 0.5 : 0,
      transparent: kind >= 2,
      opacity: kind === 3 ? 0.76 : 1,
      depthWrite: kind < 2,
      clippingPlanes: [clip],
      clipShadows: true,
    });
    material.customProgramCacheKey = () =>
      `coldfront-terrain-r186-v2-class-${kind}`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
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
${kind < 2 ? "transformed += aExpand * abs((modelViewMatrix * vec4(transformed,1.0)).z) * uPixelScale;" : ""}
`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
precision highp sampler2DArray;
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
diffuseColor *= vec4(texel.rgb*micro*macro*hue, texel.a);
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
float sky=mod(floor(vSurface.z/4096.0),16.0)/15.0;
float ao=0.48+vSurface.y/3.0*0.52;
float survey = uCut < 99999.0 ? 0.42 : 0.0;
outgoingLight *= max(0.13+sky*0.87,survey)*ao;
outgoingLight += diffuseColor.rgb * survey * 0.38;
${kind === 3 ? "float ripple=sin(absoluteWorld.x*1.2+uDisplay*0.001)*sin(absoluteWorld.z*0.9-uDisplay*0.0007); outgoingLight *= 0.96 + ripple*0.04;" : ""}
#include <opaque_fragment>`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `
#ifdef USE_FOG
float distanceFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
float heightFog=1.0-exp(-vFogDepth*fogDensity*0.25*exp(-max(absoluteWorld.y,0.0)*0.025));
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(max(distanceFog,heightFog),0.0,1.0));
#endif`,
      );
    };
    return material;
  });
  return { materials, uniforms, texture };
}
