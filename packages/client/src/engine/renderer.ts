import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  Pass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  DepthTexture,
  DirectionalLight,
  EdgesGeometry,
  FogExp2,
  Frustum,
  Group,
  HalfFloatType,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Scene,
  SRGBColorSpace,
  type Texture,
  UnsignedIntType,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { SunLight } from "three/addons/lights/SunLight.js";
import { Sky } from "three/addons/objects/Sky.js";
import type { MeshPart } from "../../../shared/src/meshing/greedy.js";
import type { LayerId, WorldBounds } from "../../../shared/src/world/types.js";
import type { ToolState } from "../contracts/game-ui.js";
import type { BodyState } from "../game/controller.js";
import type { BlockHit, Point } from "../game/raycast.js";
import { Avatar } from "./avatar.js";
import type { ChunkStore } from "./chunk-store.js";
import { CutCap } from "./cut-cap.js";
import { BlockEffects } from "./effects.js";
import { FarCutCaps } from "./far-cut-cap.js";
import { FarTerrainCoverage } from "./far-terrain-coverage.js";
import type { FarGpuPreparation } from "./far-terrain-renderer.js";
import type { NearCoverageColumn } from "./far-terrain-selection.js";
import {
  columnFitsNearDepth,
  DEFAULT_FAR_REACH,
  FAR_NEAR_PLANE,
  FarWorld,
  renderOrigin,
} from "./far-world.js";
import {
  IbaraAtmosphere,
  ibaraFogDensity,
  type WorldAtmosphereSource,
} from "./ibara-atmosphere.js";
import { IbaraEffects, ventAnchors } from "./ibara-effects.js";
import {
  createTerrainMaterials,
  TERRAIN_BLOOM_THRESHOLD,
  TERRAIN_VIEW_MODES,
  type TerrainViewMode,
  waterDepthRange,
} from "./terrain-material.js";
import { type ChunkResult, chunkKey } from "./worker-protocol.js";

export interface WorldColors {
  ink: ColorRepresentation;
  steel: ColorRepresentation;
  cap: ColorRepresentation;
}
interface RenderChunk {
  readonly worldId: number;
  readonly group: Group;
  readonly depth: Group;
  readonly cap: CutCap;
  readonly depthCap: Mesh;
  readonly border: LineSegments;
  readonly geometries: BufferGeometry[];
  readonly gpuBytes: number;
  readonly fluid: Mesh | null;
  readonly result: ChunkResult;
  readonly drawnParts: Set<number>;
  readonly partCount: number;
}
interface FarResources {
  readonly world: FarWorld;
  readonly terrain: ReturnType<typeof createTerrainMaterials>;
  readonly coverage: FarTerrainCoverage;
  readonly caps: FarCutCaps;
}
/** Same input-buffer convention as postprocessing's public RenderPass. */
class TerrainPass extends Pass {
  constructor(
    private readonly draw: (target: WebGLRenderTarget | null) => void,
  ) {
    super("Near and far terrain");
    this.needsSwap = false;
  }
  override render(_renderer: WebGLRenderer, input: WebGLRenderTarget): void {
    this.draw(this.renderToScreen ? null : input);
  }
}
/** EffectPass owns its fullscreen scene through the supported protected API.
 * Release GPU bindings without disposing the pass/effect subscription graph. */
class ContextEffectPass extends EffectPass {
  releaseContextBindings(): void {
    this.scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.fullscreenMaterial.dispose();
  }
}
function geometry(part: MeshPart): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(part.positions, 3));
  g.setAttribute("normal", new BufferAttribute(part.normals, 3));
  g.setAttribute("aExpand", new BufferAttribute(part.expansions, 3));
  g.setAttribute(
    "aPackedPosition",
    new BufferAttribute(part.packedPositions, 1),
  );
  g.setAttribute("aSurface", new BufferAttribute(part.surfaces, 3));
  // Uint16 values use the float-input path; each half is exactly representable.
  g.setAttribute(
    "aFeatureIdParts",
    new BufferAttribute(part.featureIdParts, 2, false),
  );
  g.setIndex(new BufferAttribute(part.indices, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
export class WorldRenderer {
  readonly renderer: WebGLRenderer;
  readonly camera = new PerspectiveCamera(40, 1, 0.2, 1600);
  readonly scene = new Scene();
  readonly depthScene = new Scene();
  readonly marks = new Scene();
  readonly farScene = new Scene();
  readonly farCamera = new PerspectiveCamera(
    40,
    1,
    FAR_NEAR_PLANE,
    DEFAULT_FAR_REACH,
  );
  private readonly farResources = new Map<FarWorld, FarResources>();
  private activeFar: FarWorld | null = null;
  private readonly farSun = new DirectionalLight();
  private readonly farAmbient = new HemisphereLight();
  // Initial geometric checkpoint: preserve near calibration, reveal kilometre
  // geometry through mild distance fog. Runtime aerial perspective follows later.
  private readonly farFog = new FogExp2(0xaab5b4, 0.0001);
  private readonly farWaterDepthTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly farPreparationTarget = new WebGLRenderTarget(128, 72, {
    depthBuffer: true,
    stencilBuffer: true,
  });
  readonly avatar: Avatar;
  readonly effects = new BlockEffects();
  readonly rayPoint = new Vector3();
  private readonly chunks = new Map<string, RenderChunk>();
  private readonly waterFrustum = new Frustum();
  private readonly waterViewProjection = new Matrix4();
  private readonly clip = new Plane(new Vector3(0, -1, 0), 100000);
  private readonly terrain = createTerrainMaterials(this.clip);
  readonly ibaraEffects = new IbaraEffects(this.clip);
  private readonly waterDepthTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly sun = new SunLight(0xffebcf, 2.4);
  private readonly ambient = new HemisphereLight(0xc1d3e3, 0x777363, 1.2);
  private readonly sky = new Sky();
  private readonly skyDay = { value: 1 };
  private readonly atmosphere = new IbaraAtmosphere();
  private readonly airColor = new Color();
  private readonly skyIbara = { value: 0 };
  private readonly skyIbaraZenith = { value: new Color() };
  private readonly skyIbaraHorizon = { value: new Color() };
  private airHours = 12;
  private airDisplayMs = 0;
  private airSnap = true;
  private airSnapView = true;
  private fogEnabled = true;
  private readonly fog = new FogExp2(0xaab5b4, 0.004);
  private readonly composer: EffectComposer;
  private readonly bloom: BloomEffect;
  private readonly postPass: ContextEffectPass;
  private readonly drawnEffectTextures = new Set<Texture>();
  private readonly forgetEffectTexture = (event: { target: Texture }): void => {
    this.drawnEffectTextures.delete(event.target);
    event.target.removeEventListener("dispose", this.forgetEffectTexture);
  };
  private readonly depthMaterial = new MeshBasicMaterial({
    colorWrite: false,
    clippingPlanes: [this.clip],
  });
  private readonly outline: LineSegments;
  private readonly borderMaterial = new LineBasicMaterial({
    color: 0x8fb3d9,
    transparent: true,
    opacity: 0.35,
  });
  private readonly resizeObserver: ResizeObserver;
  private hud = true;
  private postcard = false;
  private viewMode: TerrainViewMode = "normal";
  private ready = false;
  private shadowMapInvalid = false;
  private cut = Infinity;
  private worldId = 0;
  contextLost = false;
  onLost: () => void = () => {};
  onRestored: () => void = () => {};
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly colors: WorldColors,
  ) {
    const context = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      stencil: true,
    });
    if (!context) throw new Error("WebGL2 unavailable");
    this.renderer = new WebGLRenderer({
      canvas,
      context,
      antialias: false,
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.terrain.uniforms.waterDepth.value = this.waterDepthTarget.depthTexture;
    if (
      context.getParameter(context.MAX_ARRAY_TEXTURE_LAYERS) <
      this.terrain.texture.image.depth
    )
      throw new Error("Texture array exceeds hardware limit");
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      throw new Error(
        `Terrain shader preparation failed: ${gl.getProgramInfoLog(program) ?? ""}\n${gl.getShaderInfoLog(vertex) ?? ""}\n${gl.getShaderInfoLog(fragment) ?? ""}`,
      );
    };
    this.sun.position.set(-0.55, 0.8, -0.35);
    this.sun.castShadow = true;
    this.sun.shadow.camera.far = 256;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun, this.ambient);
    this.scene.fog = this.fog;
    this.farScene.add(this.farSun, this.farAmbient);
    this.farScene.fog = this.farFog;
    this.setSkyUniform("cloudDensity", 0);
    this.sky.scale.setScalar(4500);
    this.setSkyUniform("turbidity", 3);
    this.setSkyUniform("rayleigh", 1.5);
    this.setSkyUniform("mieCoefficient", 0.004);
    this.setSkyUniform("mieDirectionalG", 0.8);
    this.farScene.add(this.sky);
    this.sky.material.uniforms.uDay = this.skyDay;
    this.sky.material.uniforms.uIbara = this.skyIbara;
    this.sky.material.uniforms.uIbaraZenith = this.skyIbaraZenith;
    this.sky.material.uniforms.uIbaraHorizon = this.skyIbaraHorizon;
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace(
        "void main()",
        `uniform float uDay;
        uniform float uIbara;
        uniform vec3 uIbaraZenith;
        uniform vec3 uIbaraHorizon;
        void main()`,
      )
      .replace(
        "gl_FragColor = vec4( texColor, 1.0 );",
        `
      ivec3 starCell=ivec3(floor(direction*900.0));
      uint starHash=uint(starCell.x)*0x9e3779b1u ^ uint(starCell.y)*0x85ebca77u ^ uint(starCell.z)*0xc2b2ae3du;
      starHash^=starHash>>16u; starHash*=0x7feb352du; starHash^=starHash>>15u;
      float star=(starHash&4095u)==0u && direction.y>0.08 ? 0.55 : 0.0;
      vec3 nightSky=mix(vec3(0.028,0.045,0.078),vec3(0.009,0.017,0.037),max(0.0,direction.y))+star;
      vec3 ordinarySky=mix(nightSky,texColor,uDay);
      // Standing smoke is part of regional air, including frozen postcards.
      // The original sun direction/disc are retained; this dim red disc and
      // broad ochre-grey sky remain below the emissive bloom threshold.
      if(uIbara>0.0){
        vec3 smoke=mix(uIbaraZenith,uIbaraHorizon,exp(-max(0.0,direction.y)*4.0));
        smoke*=0.97+0.03*noise(direction.xz*3.0+vec2(direction.y*4.0));
        smoke+=vec3(0.4,0.09,0.04)*sundisc*uDay;
        ordinarySky=mix(ordinarySky,smoke,uIbara);
      }
      gl_FragColor = vec4(ordinarySky,1.0);`,
      );
    this.avatar = new Avatar(colors.steel, colors.ink);
    this.scene.add(this.avatar.group);
    this.depthScene.add(this.avatar.depth);
    this.marks.add(this.avatar.silhouette);
    this.scene.add(this.effects.particles, this.effects.pop);
    this.scene.add(this.ibaraEffects.flames, this.ibaraEffects.embers);
    this.marks.add(this.effects.ghost);
    // Effects cache tiles beyond the lifetime of individual materials. Remember
    // only maps actually drawn so even a no-longer-selected tile can release
    // its old context's texture listener when that context is lost.
    for (const mesh of [this.effects.pop, this.effects.ghost]) {
      const beforeRender = mesh.onBeforeRender;
      mesh.onBeforeRender = (...args) => {
        beforeRender.apply(mesh, args);
        const map = (args[4] as MeshBasicMaterial).map;
        if (map && !this.drawnEffectTextures.has(map)) {
          this.drawnEffectTextures.add(map);
          map.addEventListener("dispose", this.forgetEffectTexture);
        }
      };
    }
    this.outline = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1.006, 1.006, 1.006)),
      new LineBasicMaterial({
        color: colors.ink,
        toneMapped: false,
        depthWrite: false,
      }),
    );
    this.outline.visible = false;
    this.marks.add(this.outline);
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: HalfFloatType,
      multisampling: 0,
    });
    this.composer.addPass(
      new TerrainPass((target) => this.drawTerrain(target)),
    );
    const bloom = new BloomEffect({
      intensity: 0.2,
      luminanceThreshold: TERRAIN_BLOOM_THRESHOLD,
      luminanceSmoothing: 0.05,
      mipmapBlur: true,
    });
    this.bloom = bloom;
    this.postPass = new ContextEffectPass(
      this.camera,
      bloom,
      new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
        adaptive: false,
      }),
    );
    this.composer.addPass(this.postPass);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    canvas.addEventListener("webglcontextlost", this.lost);
    canvas.addEventListener("webglcontextrestored", this.restored);
  }
  private lost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    for (const resource of this.farResources.values())
      resource.world.contextLost();
    this.terrain.uniforms.waterDepthReady.value = 0;
    this.releaseContextBindings();
    this.onLost();
  };
  /** Three recreates its GPU managers on restore. Dispose their listeners while
   * the context is still lost, before old buffer/texture/VAO handles can be
   * presented to the new managers. CPU arrays, settings and scene objects stay. */
  private releaseContextBindings(): void {
    const geometries = new Set<BufferGeometry>(),
      materials = new Set<Material>([
        ...this.terrain.materials,
        this.depthMaterial,
        this.borderMaterial,
      ]),
      textures = new Set<Texture>([
        this.terrain.texture,
        ...this.drawnEffectTextures,
      ]);
    for (const scene of [
      this.scene,
      this.depthScene,
      this.marks,
      this.farScene,
    ])
      scene.traverse((object) => {
        if (object instanceof InstancedMesh) {
          const morphTexture = object.morphTexture;
          object.dispose();
          // InstancedMesh.dispose releases and nulls this texture; retain its
          // CPU morph data/reference so the restored mesh can upload it again.
          object.morphTexture = morphTexture;
        }
        if (!(object instanceof Mesh || object instanceof LineSegments)) return;
        geometries.add(object.geometry);
        const owned = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of owned) {
          materials.add(material);
          const map = (material as MeshBasicMaterial).map;
          if (map) textures.add(map);
        }
      });
    for (const geometry of geometries) geometry.dispose();
    // Shadow clipping caches also install manager-specific material listeners.
    for (const material of materials) material.dispose();
    for (const chunk of this.chunks.values()) textures.add(chunk.cap.texture);
    for (const texture of textures) texture.dispose();
    this.drawnEffectTextures.clear();
    this.waterDepthTarget.dispose();
    this.farWaterDepthTarget.dispose();
    this.farPreparationTarget.dispose();
    for (const resource of this.farResources.values()) {
      resource.coverage.mask.value.dispose();
      resource.terrain.uniforms.waterDepthReady.value = 0;
      for (const material of resource.terrain.materials) material.dispose();
    }
    this.sun.shadow.dispose();
    this.composer.inputBuffer.dispose();
    this.composer.outputBuffer.dispose();
    // Effect.dispose releases its owned targets/materials, retaining settings,
    // mip arrays and subscriptions. Composer/EffectPass.dispose destroys them.
    this.bloom.dispose();
    this.postPass.releaseContextBindings();
  }
  private restored = (): void => {
    this.contextLost = false;
    this.ready = false;
    // The target object survives context loss, but its GPU depth does not.
    this.shadowMapInvalid = true;
    this.renderer.shadowMap.needsUpdate = true;
    for (const resource of this.farResources.values())
      resource.coverage.mask.value.needsUpdate = true;
    this.onRestored();
  };
  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth),
      height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(
      this.postcard ? 1 : Math.min(devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    const waterSize = this.terrain.uniforms.waterDepthSize.value;
    this.renderer.getDrawingBufferSize(waterSize);
    this.waterDepthTarget.setSize(waterSize.x, waterSize.y);
    this.farWaterDepthTarget.setSize(waterSize.x, waterSize.y);
    for (const resource of this.farResources.values()) {
      resource.terrain.uniforms.waterDepthSize.value.copy(waterSize);
      resource.terrain.uniforms.waterDepthReady.value = 0;
    }
    this.terrain.uniforms.waterDepthReady.value = 0;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.terrain.uniforms.pixelScale.value =
      ((2 * Math.tan((this.camera.fov * Math.PI) / 360)) /
        (height * this.renderer.getPixelRatio())) *
      0.4;
  }
  upload(result: ChunkResult): void {
    const key = `${result.world.id}:${chunkKey(result.address)}`;
    this.remove(chunkKey(result.address), result.world.id);
    const group = new Group(),
      depth = new Group(),
      geometries: BufferGeometry[] = [];
    const drawnParts = new Set<number>();
    let bytes = 0,
      fluid: Mesh | null = null;
    group.position.set(
      result.address.cx * 32,
      result.address.cy * 32,
      result.address.cz * 32,
    );
    depth.position.copy(group.position);
    result.mesh.parts.forEach((part, index) => {
      if (!part.indices.length) return;
      const g = geometry(part);
      geometries.push(g);
      bytes +=
        part.positions.byteLength +
        part.normals.byteLength +
        part.expansions.byteLength +
        part.packedPositions.byteLength +
        part.surfaces.byteLength +
        part.featureIdParts.byteLength +
        part.indices.byteLength;
      const mesh = new Mesh(g, this.terrain.materials[index]);
      mesh.onAfterRender = () => {
        drawnParts.add(index);
      };
      mesh.castShadow = index < 2 || index === 4;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (index === 3) fluid = mesh;
      if (index < 2 || index === 4) depth.add(new Mesh(g, this.depthMaterial));
    });
    const opaque = result.mesh.parts[0];
    this.ibaraEffects.register(
      key,
      result.world.id,
      opaque ? ventAnchors(opaque, group.position) : [],
    );
    const region = new Color().setRGB(
      result.regionColor[0] / 255,
      result.regionColor[1] / 255,
      result.regionColor[2] / 255,
      SRGBColorSpace,
    );
    const capColor = new Color(this.colors.cap).lerp(region, 0.1),
      cap = new CutCap(result.blocks, result.address.cy, capColor);
    cap.mesh.position.set(
      result.address.cx * 32 + 16,
      this.cut,
      result.address.cz * 32 + 16,
    );
    cap.update(this.cut);
    const depthCap = new Mesh(cap.mesh.geometry, cap.mesh.material.clone());
    depthCap.material.colorWrite = false;
    depthCap.material.onBeforeCompile = cap.mesh.material.onBeforeCompile;
    depthCap.material.customProgramCacheKey =
      cap.mesh.material.customProgramCacheKey;
    depthCap.rotation.copy(cap.mesh.rotation);
    depthCap.position.copy(cap.mesh.position);
    depthCap.visible = cap.mesh.visible;
    const border = new LineSegments(
      new EdgesGeometry(new BoxGeometry(32, 32, 32)),
      this.borderMaterial,
    );
    border.position.copy(group.position).addScalar(16);
    border.visible = false;
    this.scene.add(group, cap.mesh, border);
    this.depthScene.add(depth, depthCap);
    // Initialize after attachment: water can query matrixWorld before a draw.
    // A future CPU rebase/reparent must explicitly refresh these static matrices.
    for (const terrainRoot of [group, depth]) {
      terrainRoot.updateWorldMatrix(true, true);
      terrainRoot.traverse((object) => {
        object.matrixAutoUpdate = false;
        object.matrixWorldAutoUpdate = false;
      });
    }
    this.chunks.set(key, {
      worldId: result.world.id,
      group,
      depth,
      cap,
      depthCap,
      border,
      geometries,
      gpuBytes: bytes + 32768,
      fluid,
      result,
      drawnParts,
      partCount: result.mesh.parts.filter((part) => part.indices.length > 0)
        .length,
    });
    group.visible = depth.visible = result.world.id === this.worldId;
    cap.mesh.visible &&= result.world.id === this.worldId;
    depthCap.visible = cap.mesh.visible;
  }
  remove(addressKey: string, worldId = this.worldId): void {
    const key = `${worldId}:${addressKey}`;
    const c = this.chunks.get(key);
    if (!c) return;
    this.scene.remove(c.group, c.cap.mesh, c.border);
    this.depthScene.remove(c.depth, c.depthCap);
    for (const g of c.geometries) g.dispose();
    c.cap.dispose();
    (c.depthCap.material as Material).dispose();
    c.border.geometry.dispose();
    this.chunks.delete(key);
    this.ibaraEffects.remove(key);
  }
  setWorld(worldId: number): void {
    if (worldId !== this.worldId) this.airSnap = this.airSnapView = true;
    this.worldId = worldId;
    // A new world settles immediately. Re-selecting the restored source must
    // not discard an in-progress blend after a failed travel transaction.
    if (this.atmosphere) this.setTime(this.airHours);
    this.ibaraEffects?.setWorld(worldId);
    this.useFar(this.activeFar);
    for (const chunk of this.chunks.values()) {
      const active = chunk.worldId === worldId;
      chunk.group.visible = chunk.depth.visible = active;
      chunk.cap.update(this.cut);
      chunk.cap.mesh.visible &&= active;
      chunk.depthCap.visible = chunk.cap.mesh.visible;
      if (!active) chunk.border.visible = false;
    }
  }
  removeWorld(worldId: number): void {
    this.atmosphere?.remove(worldId);
    for (const world of this.farResources.keys())
      if (world.worldId === worldId) this.releaseFar(world);
    for (const key of [...this.chunks.keys()])
      if (key.startsWith(`${worldId}:`))
        this.remove(key.slice(key.indexOf(":") + 1), worldId);
  }
  createFarWorld(near: ChunkStore, layer: LayerId = "surface"): FarWorld {
    const coverage = new FarTerrainCoverage();
    const terrain = createTerrainMaterials(this.clip, {
      mode: "far",
      shared: this.terrain,
      coverage,
    });
    const caps = new FarCutCaps({
      color: this.colors.cap,
      coverage,
      origin: this.terrain.uniforms.origin,
    });
    let world: FarWorld;
    try {
      world = new FarWorld(near, layer, {
        materials: terrain.materials,
        caps,
        onNearCoverage: (columns) => coverage.update(columns),
        prepareGpu: (probe) => this.prepareFarGpu(world, probe),
      });
    } catch (error) {
      caps.dispose();
      terrain.dispose();
      coverage.dispose();
      throw error;
    }
    terrain.uniforms.waterDepth.value = this.farWaterDepthTarget.depthTexture;
    terrain.uniforms.waterDepthSize.value.copy(
      this.terrain.uniforms.waterDepthSize.value,
    );
    this.farResources.set(world, { world, terrain, caps, coverage });
    this.farScene.add(world.renderer.group);
    world.renderer.group.visible = false;
    return world;
  }
  useFar(world: FarWorld | null): void {
    if (world && !this.farResources.has(world))
      throw new Error("Unknown far world");
    this.activeFar = world;
    for (const resource of this.farResources.values())
      resource.world.renderer.group.visible =
        resource.world === world && world.worldId === this.worldId;
  }
  releaseFar(world: FarWorld): void {
    const resource = this.farResources.get(world);
    if (!resource) return;
    if (this.activeFar === world) this.activeFar = null;
    this.farScene.remove(world.renderer.group);
    world.dispose();
    resource.caps.dispose();
    resource.terrain.dispose();
    resource.coverage.dispose();
    this.farResources.delete(world);
  }
  private nearCoverage(near: ChunkStore): NearCoverageColumn[] {
    if (near.world.id !== this.worldId) return [];
    const columns = new Map<string, { cx: number; cz: number }>();
    for (const chunk of near.chunks.values())
      columns.set(`${chunk.address.cx},${chunk.address.cz}`, chunk.address);
    const result: NearCoverageColumn[] = [];
    for (const { cx, cz } of columns.values()) {
      const bounds: WorldBounds = {
        minSurfaceY: 0,
        maxSurfaceY: 0,
        maxSolidY: 0,
        maxFluidY: 0,
      };
      near.context.conservativeBounds(
        {
          minX: cx * 32,
          minZ: cz * 32,
          maxX: (cx + 1) * 32,
          maxZ: (cz + 1) * 32,
        },
        bounds,
      );
      let low = Math.max(-48, Math.floor((bounds.minSurfaceY - 3) / 32));
      let high = Math.min(
        31,
        Math.floor(
          Math.max(bounds.maxSurfaceY, bounds.maxSolidY, bounds.maxFluidY) / 32,
        ),
      );
      for (const edit of near.edits.values())
        if (Math.floor(edit.x / 32) === cx && Math.floor(edit.z / 32) === cz) {
          low = Math.min(low, Math.floor(edit.y / 32));
          high = Math.max(high, Math.floor(edit.y / 32));
        }
      // If the cut exposes a deeper band, never mask it with surface-only chunks.
      if (Number.isFinite(this.cut))
        low = Math.max(-48, Math.min(low, Math.floor(this.cut / 32)));
      let complete = true;
      for (let cy = low; cy <= high; cy++) {
        const key = `${cx},${cy},${cz}`;
        const stored = near.chunks.get(key);
        const drawn = this.chunks.get(`${near.world.id}:${key}`);
        if (
          !stored?.result ||
          stored.state !== "visible" ||
          stored.result.revision !== stored.revision ||
          !drawn ||
          drawn.result !== stored.result ||
          !drawn.group.visible ||
          drawn.drawnParts.size !== drawn.partCount
        ) {
          complete = false;
          break;
        }
      }
      if (!complete) continue;
      const column: NearCoverageColumn = {
        minX: cx * 32,
        maxX: (cx + 1) * 32,
        minZ: cz * 32,
        maxZ: (cz + 1) * 32,
        minY: low * 32,
        maxY: Math.min((high + 1) * 32, this.cut),
        ready: true,
        drawn: true,
      };
      if (
        column.maxY >= column.minY &&
        columnFitsNearDepth(column, this.camera)
      )
        result.push(column);
    }
    return result;
  }
  private syncFarView(cut = this.cut): void {
    this.farCamera.position.copy(this.camera.position);
    this.farCamera.quaternion.copy(this.camera.quaternion);
    this.farCamera.fov = this.camera.fov;
    this.farCamera.aspect = this.camera.aspect;
    this.farCamera.near = FAR_NEAR_PLANE;
    this.farCamera.far = this.activeFar?.reach ?? DEFAULT_FAR_REACH;
    this.farCamera.updateProjectionMatrix();
    this.farCamera.updateMatrixWorld();
    const origin = renderOrigin(this.camera.position);
    this.terrain.uniforms.origin.value.set(origin.x, origin.y, origin.z);
    this.activeFar?.setPresentation(
      origin,
      cut,
      this.nearCoverage(this.activeFar.near),
    );
  }
  /** Staging crosses a real synchronous draw boundary, including empty tiles.
   * A private target and full public state restoration preserve the source view. */
  private prepareFarGpu(world: FarWorld, probe: FarGpuPreparation): void {
    if (this.contextLost)
      throw new Error("WebGL context lost during far preparation");
    const resource = this.farResources.get(world);
    if (!resource) throw new Error("Far preparation owner missing");
    const target = this.renderer.getRenderTarget();
    const viewport = this.renderer.getViewport(new Vector4());
    const scissor = this.renderer.getScissor(new Vector4());
    const scissorTest = this.renderer.getScissorTest();
    const autoClear = this.renderer.autoClear;
    const origin = this.terrain.uniforms.origin.value.clone();
    const waterReady = resource.terrain.uniforms.waterDepthReady.value;
    const clipHeight = this.clip.constant;
    const uniformCut = this.terrain.uniforms.cut.value;
    const skyPosition = this.sky.position.clone();
    const shadowAuto = this.renderer.shadowMap.autoUpdate;
    const shadowUpdate = this.renderer.shadowMap.needsUpdate;
    const visibility = [...this.farResources.values()].map((entry) => ({
      group: entry.world.renderer.group,
      visible: entry.world.renderer.group.visible,
    }));
    const culling = probe.batches.map((batch) => ({
      batch,
      value: batch.frustumCulled,
    }));
    try {
      const nextOrigin = renderOrigin(world.camera.position);
      world.renderer.setOrigin(nextOrigin.x, nextOrigin.y, nextOrigin.z);
      this.terrain.uniforms.origin.value.set(
        nextOrigin.x,
        nextOrigin.y,
        nextOrigin.z,
      );
      for (const entry of visibility)
        entry.group.visible = entry.group === probe.group;
      for (const entry of culling) entry.batch.frustumCulled = false;
      resource.terrain.uniforms.waterDepthReady.value = 0;
      // A candidate's first plan and private draw use its cut even while a
      // different source view remains active on the visible framebuffer.
      this.clip.constant = Number.isFinite(world.cutHeight)
        ? world.cutHeight
        : 100000;
      this.terrain.uniforms.cut.value = this.clip.constant;
      this.sky.position.copy(world.camera.position);
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = false;
      this.renderer.autoClear = true;
      this.renderer.setScissorTest(false);
      this.renderer.setRenderTarget(this.farPreparationTarget);
      this.renderer.render(this.farScene, world.camera);
      const gl = this.renderer.getContext();
      if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)
        throw new Error("Far geometry GPU preparation failed");
    } finally {
      resource.terrain.uniforms.waterDepthReady.value = waterReady;
      this.clip.constant = clipHeight;
      this.terrain.uniforms.cut.value = uniformCut;
      for (const entry of visibility) entry.group.visible = entry.visible;
      for (const entry of culling) entry.batch.frustumCulled = entry.value;
      this.terrain.uniforms.origin.value.copy(origin);
      this.sky.position.copy(skyPosition);
      this.renderer.shadowMap.autoUpdate = shadowAuto;
      this.renderer.shadowMap.needsUpdate = shadowUpdate;
      this.renderer.autoClear = autoClear;
      this.renderer.setRenderTarget(target);
      this.renderer.setViewport(viewport);
      this.renderer.setScissor(scissor);
      this.renderer.setScissorTest(scissorTest);
    }
  }
  private drawTerrain(target: WebGLRenderTarget | null): void {
    const background = this.scene.background;
    const autoClear = this.renderer.autoClear;
    try {
      this.renderer.autoClear = false;
      this.scene.background = null;
      this.renderer.setRenderTarget(target);
      this.renderer.clear(true, true, true);
      this.renderer.render(this.farScene, this.farCamera);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.scene.background = background;
      this.renderer.autoClear = autoClear;
    }
  }
  private prepareFarWaterDepth(): void {
    const resource = this.activeFar && this.farResources.get(this.activeFar);
    if (!resource) return;
    const uniforms = resource.terrain.uniforms;
    uniforms.waterDepthReady.value = 0;
    const target = this.renderer.getRenderTarget();
    const autoClear = this.renderer.autoClear;
    const background = this.farScene.background;
    const sky = this.sky.visible;
    const saved = new Map<
      Material,
      { colorWrite: boolean; visible: boolean }
    >();
    for (const material of resource.terrain.materials)
      saved.set(material, {
        colorWrite: material.colorWrite,
        visible: material.visible,
      });
    // Keep the original vertex/fragment hooks: overrideMaterial would lose
    // batching transforms, coverage discard, cutout alpha and cap occupancy.
    this.activeFar?.renderer.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (!saved.has(material))
          saved.set(material, {
            colorWrite: material.colorWrite,
            visible: material.visible,
          });
        material.colorWrite = false;
      }
    });
    try {
      for (const index of [2, 3]) {
        const material = resource.terrain.materials[index];
        if (material) material.visible = false;
      }
      this.sky.visible = false;
      this.farScene.background = null;
      this.renderer.autoClear = true;
      waterDepthRange(
        this.farCamera.near,
        this.farCamera.far,
        uniforms.waterDepthLinearize.value,
      );
      this.renderer.setRenderTarget(this.farWaterDepthTarget);
      this.renderer.render(this.farScene, this.farCamera);
    } finally {
      for (const [material, value] of saved) {
        material.colorWrite = value.colorWrite;
        material.visible = value.visible;
      }
      this.sky.visible = sky;
      this.farScene.background = background;
      this.renderer.setRenderTarget(target);
      this.renderer.autoClear = autoClear;
    }
    uniforms.waterDepthReady.value = 1;
  }
  /** Draw every destination mesh into an offscreen target before atomic commit.
   * Compile alone does not upload vertex/index buffers. This preserves the visible
   * source framebuffer and detects a lost context or failed destination draw. */
  prepareView(
    worldId: number,
    position: Point,
    focus: Point,
    far = this.activeFar,
  ): void {
    if (this.contextLost)
      throw new Error("WebGL context lost during view preparation");
    const oldWorld = this.worldId,
      oldPosition = this.camera.position.clone(),
      oldQuaternion = this.camera.quaternion.clone(),
      oldOrigin = this.terrain.uniforms.origin.value.clone(),
      oldWaterDepthReady = this.terrain.uniforms.waterDepthReady.value,
      restoreAir = this.atmosphere?.checkpoint(),
      oldAirSnap = this.airSnap,
      oldAirSnapView = this.airSnapView,
      oldFar = this.activeFar,
      oldFarCut = oldFar?.cutHeight ?? this.cut;
    const target = new WebGLRenderTarget(128, 72, {
      depthBuffer: true,
      stencilBuffer: true,
    });
    const oldTarget = this.renderer.getRenderTarget();
    const screenPasses = this.composer.passes.map((pass) => ({
      pass,
      screen: pass.renderToScreen,
    }));
    const culling: { object: Mesh; value: boolean }[] = [];
    try {
      // This preparation draws at another viewport/camera. Never sample a depth
      // texture belonging to the source view; normal render refreshes it first.
      this.terrain.uniforms.waterDepthReady.value = 0;
      this.setWorld(worldId);
      this.useFar(far);
      this.setView(position, focus, true);
      this.terrain.uniforms.origin.value.set(
        Math.floor(position.x / 1024) * 1024,
        0,
        Math.floor(position.z / 1024) * 1024,
      );
      this.syncFarView();
      this.prepareFarWaterDepth();
      this.ibaraEffects?.update(
        this.terrain.uniforms.display.value,
        this.cut,
        this.camera.position,
      );
      for (const chunk of this.chunks.values())
        if (chunk.worldId === worldId)
          for (const group of [chunk.group, chunk.depth])
            group.traverse((object) => {
              if (object instanceof Mesh) {
                culling.push({ object, value: object.frustumCulled });
                object.frustumCulled = false;
              }
            });
      this.compile();
      // Warm the actual bloom/ACES chain as well, without touching the source
      // framebuffer. Pass.renderToScreen is the public composer output switch.
      for (const item of screenPasses) item.pass.renderToScreen = false;
      this.composer.render(0);
      this.renderer.setRenderTarget(target);
      this.drawTerrain(target);
      this.renderer.render(this.depthScene, this.camera);
      this.renderer.render(this.marks, this.camera);
      const gl = this.renderer.getContext();
      if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)
        throw new Error("Destination render preparation failed");
    } finally {
      this.terrain.uniforms.waterDepthReady.value = oldWaterDepthReady;
      for (const item of screenPasses) item.pass.renderToScreen = item.screen;
      for (const item of culling) item.object.frustumCulled = item.value;
      this.renderer.setRenderTarget(oldTarget);
      target.dispose();
      this.camera.position.copy(oldPosition);
      this.sky.position.copy(oldPosition);
      this.camera.quaternion.copy(oldQuaternion);
      this.camera.updateMatrixWorld();
      this.terrain.uniforms.origin.value.copy(oldOrigin);
      this.useFar(oldFar);
      this.setWorld(oldWorld);
      this.syncFarView(oldFarCut);
      if (restoreAir) {
        restoreAir();
        // Reapply the saved blend at the unchanged display time without
        // consuming a pending snap; restore both flags after the light update.
        this.airSnap = false;
        this.setTime(this.airHours);
        this.airSnap = oldAirSnap;
        this.airSnapView = oldAirSnapView;
      }
      this.ibaraEffects?.update(
        this.terrain.uniforms.display.value,
        this.cut,
        this.camera.position,
      );
    }
  }
  setView(position: Point, focus: Point, settleAtmosphere = false): void {
    this.camera.position.set(position.x, position.y, position.z);
    // Sky is a4500m box. Keep the camera inside it everywhere in the45km world;
    // its shader derives the ray from worldPosition-cameraPosition.
    this.sky.position.copy(this.camera.position);
    this.camera.lookAt(focus.x, focus.y, focus.z);
    this.camera.updateMatrixWorld();
    this.syncFarView();
    if (this.atmosphere) {
      this.airSnap ||= this.airSnapView || settleAtmosphere;
      this.airSnapView = false;
      this.setTime(this.airHours);
    }
  }
  pointerRay(x: number, y: number): { origin: Point; direction: Point } {
    this.rayPoint
      .set(x, y, 0.5)
      .unproject(this.camera)
      .sub(this.camera.position)
      .normalize();
    return { origin: this.camera.position, direction: this.rayPoint };
  }
  update(
    body: BodyState,
    previous: BodyState,
    alpha: number,
    displayMs: number,
    cut: number,
    tools: ToolState,
    hit: BlockHit | null,
    ghost: Point | null,
    block: number,
    occluded: boolean,
    atmosphereSource?: WorldAtmosphereSource,
    preparingAtmosphere = false,
  ): void {
    if (atmosphereSource) this.atmosphere.register(atmosphereSource);
    // A candidate can reset its clock even within the same world. Preparation
    // explicitly preserves the source blend clock until the final view commits.
    if (!preparingAtmosphere) this.airDisplayMs = displayMs;
    this.cut = cut;
    this.clip.constant = Number.isFinite(cut) ? cut : 100000;
    this.terrain.uniforms.cut.value = this.clip.constant;
    this.terrain.uniforms.display.value = displayMs;
    this.terrain.uniforms.origin.value.set(
      Math.floor(this.camera.position.x / 1024) * 1024,
      0,
      Math.floor(this.camera.position.z / 1024) * 1024,
    );
    const bodyDistance = Math.hypot(
      this.camera.position.x - body.x,
      this.camera.position.y - body.y - 1,
      this.camera.position.z - body.z,
    );
    const outlineWidth =
      (1.1 * 2 * bodyDistance * Math.tan((this.camera.fov * Math.PI) / 360)) /
      (Math.max(1, this.canvas.clientHeight) * this.renderer.getPixelRatio());
    this.avatar.update(body, previous, alpha, displayMs, outlineWidth);
    this.avatar.group.visible = !this.postcard;
    this.avatar.depth.visible = !this.postcard;
    this.avatar.silhouette.visible = this.hud && !this.postcard && occluded;
    this.effects.update(displayMs, cut, this.camera.position);
    this.effects.particles.visible =
      !this.postcard && this.viewMode === "normal";
    this.effects.pop.visible &&= !this.postcard && this.viewMode === "normal";
    this.ibaraEffects.setMode(this.viewMode, this.postcard);
    this.ibaraEffects.update(displayMs, cut, this.camera.position);
    this.terrain.uniforms.pop.value
      .copy(this.effects.pop.position)
      .addScalar(-0.5);
    this.terrain.uniforms.popActive.value = this.effects.pop.visible ? 1 : 0;
    this.effects.setGhost(this.hud && !this.postcard ? ghost : null, block);
    this.outline.visible = this.hud && !this.postcard && hit !== null;
    if (hit) this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    for (const c of this.chunks.values()) {
      c.cap.update(cut);
      c.cap.mesh.visible &&= c.worldId === this.worldId;
      c.depthCap.visible = c.cap.mesh.visible;
      c.depthCap.position.copy(c.cap.mesh.position);
      c.border.visible = tools.chunkBorders && c.worldId === this.worldId;
    }
    for (const m of this.terrain.materials) m.wireframe = tools.wireframe;
    for (const resource of this.farResources.values())
      for (const material of resource.terrain.materials)
        material.wireframe = tools.wireframe;
    this.fogEnabled = tools.fog;
    this.fog.density = tools.fog ? 0.004 : 0;
    this.sun.shadow.intensity = tools.shadows ? 1 : 0;
    // Keep the shadowed shader variant. Its depth sampler needs a valid map even
    // at zero intensity, so initialize once before suspending disabled updates.
    // Re-enabling must refresh after any intervening camera/world/cut changes.
    this.renderer.shadowMap.autoUpdate = tools.shadows;
    this.renderer.shadowMap.needsUpdate =
      tools.shadows || this.shadowMapInvalid || this.sun.shadow.map === null;
    this.setTime(tools.timeHours);
  }
  private setSkyUniform(name: string, value: number | Vector3): void {
    const uniform = this.sky.material.uniforms[name];
    if (!uniform) throw new Error(`Missing Sky uniform: ${name}`);
    uniform.value = value;
  }
  setTime(hours: number): void {
    this.airHours = hours;
    const angle = ((hours - 6) / 12) * Math.PI,
      elevation = Math.sin(angle),
      day = Math.max(0, Math.min(1, (elevation + 0.08) / 0.25));
    this.skyDay.value = day;
    this.sun.position
      .set(
        -Math.cos(angle) * 0.75,
        Math.max(0.08, elevation),
        Math.cos(angle) * 0.65,
      )
      .normalize();
    this.sun.color.set(day > 0.1 && elevation < 0.4 ? 0xffb76f : 0xfff1d9);
    this.sun.intensity = day * 2.1;
    this.ambient.color.set(day > 0.2 ? 0xb8cfdf : 0x9cb5de);
    this.ambient.groundColor.set(day > 0.2 ? 0x6c6e51 : 0x596a8d);
    this.ambient.intensity = 2.5 - day * 1.1;
    this.setSkyUniform("sunPosition", this.sun.position);
    this.setSkyUniform("rayleigh", 1.2 + day * 0.5);
    this.sky.visible = this.cut === Infinity;
    this.fog.color.set(
      day > 0.2 ? (elevation < 0.4 ? 0xb6aa92 : 0xa6b6bd) : 0x3b526f,
    );
    const regionalWeight = this.atmosphere.sample(
        this.worldId,
        this.camera.position,
        this.airDisplayMs,
        this.airSnap,
      ),
      // Clay/feature diagnostics retain their original neutral strong light.
      // Under a cut, surface air must not replace the underground ambience.
      weight =
        this.viewMode === "normal" && this.cut === Infinity
          ? regionalWeight
          : 0;
    this.airSnap = false;
    this.skyIbara.value = weight;
    this.skyIbaraZenith.value
      .set(0x68615c)
      .lerp(this.airColor.set(0x343941), 1 - day);
    this.skyIbaraHorizon.value
      .set(0x86745f)
      .lerp(this.airColor.set(0x4b4540), 1 - day);
    this.sun.color.lerp(this.airColor.set(0xe58d69), weight * day);
    this.sun.intensity *= 1 - weight * 0.5;
    this.ambient.color.lerp(
      this.airColor.set(day > 0.2 ? 0xd0c0ac : 0x9eacbb),
      weight,
    );
    this.ambient.groundColor.lerp(
      this.airColor.set(day > 0.2 ? 0x827362 : 0x596574),
      weight,
    );
    // Diffuse warm fill preserves the existing dark rock's surface reading
    // while smoke attenuates directional sunlight. Exposure stays fixed.
    this.ambient.intensity +=
      (2.4 - day * 0.55 - this.ambient.intensity) * weight;
    this.fog.color.lerp(
      this.airColor.set(day > 0.2 ? 0x736554 : 0x41454d),
      weight,
    );
    this.fog.density = this.fogEnabled
      ? 0.004 + (ibaraFogDensity(this.camera.position.y) - 0.004) * weight
      : 0;
    this.scene.background = this.fog.color;
    this.farScene.background = this.fog.color;
    this.farFog.color.copy(this.fog.color);
    this.farFog.density = this.fogEnabled ? 0.0001 : 0;
    this.farSun.position.copy(this.sun.position);
    this.farSun.color.copy(this.sun.color);
    this.farSun.intensity = this.sun.intensity;
    this.farAmbient.color.copy(this.ambient.color);
    this.farAmbient.groundColor.copy(this.ambient.groundColor);
    this.farAmbient.intensity = this.ambient.intensity;
    this.terrain.uniforms.night.value = 1 - day;
  }
  setHud(visible: boolean): void {
    this.hud = visible;
  }
  setViewMode(mode: TerrainViewMode): void {
    this.viewMode = mode;
    this.terrain.uniforms.viewMode.value = TERRAIN_VIEW_MODES[mode];
    this.bloom.intensity = mode === "normal" ? 0.2 : 0;
    this.ibaraEffects.setMode(mode, this.postcard);
    if (mode !== "normal") {
      this.effects.particles.visible = this.effects.pop.visible = false;
      this.terrain.uniforms.popActive.value = 0;
    }
    if (this.atmosphere) this.setTime(this.airHours);
  }
  setPostcard(active: boolean): void {
    this.postcard = active;
    this.ibaraEffects?.setMode(this.viewMode ?? "normal", active);
    this.camera.fov = active ? 70 : 40;
    this.camera.updateProjectionMatrix();
    this.syncFarView();
    this.resize();
  }
  compile(): void {
    const saved: { object: { visible: boolean }; visible: boolean }[] = [];
    const sample = [...this.chunks.values()].find((c) => c.geometries.length)
      ?.geometries[0];
    // Compile even when an empty destination has no sample geometry. Both
    // shadow-receiving and unshadowed variants use the production attribute ABI.
    const fallback = sample ? null : new BoxGeometry(1, 1, 1);
    if (fallback) {
      const count = fallback.getAttribute("position").count;
      fallback.setAttribute(
        "aPackedPosition",
        new BufferAttribute(new Float32Array(count), 1),
      );
      fallback.setAttribute(
        "aSurface",
        new BufferAttribute(new Float32Array(count * 3), 3),
      );
      fallback.setAttribute(
        "aExpand",
        new BufferAttribute(new Int8Array(count * 3), 3),
      );
      fallback.setAttribute(
        "aFeatureIdParts",
        new BufferAttribute(new Uint16Array(count * 2), 2, false),
      );
    }
    const variants = this.terrain.materials.flatMap((material) =>
      [false, true].map((shadows) => {
        const mesh = new Mesh(sample ?? (fallback as BufferGeometry), material);
        mesh.receiveShadow = mesh.castShadow = shadows;
        return mesh;
      }),
    );
    this.scene.add(...variants);
    for (const object of [
      this.effects.pop,
      this.effects.ghost,
      this.avatar.silhouette,
      this.outline,
      this.ibaraEffects.flames,
      this.ibaraEffects.embers,
      ...[...this.chunks.values()].flatMap((c) => [c.cap.mesh, c.depthCap]),
    ]) {
      saved.push({ object, visible: object.visible });
      object.visible = true;
    }
    try {
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.farScene, this.farCamera);
      this.renderer.compile(this.depthScene, this.camera);
      this.renderer.compile(this.marks, this.camera);
      this.ready = true;
    } finally {
      for (const s of saved) s.object.visible = s.visible;
      this.scene.remove(...variants);
      fallback?.dispose();
    }
  }
  render(): void {
    if (!this.ready || this.contextLost) return;
    this.renderer.info.reset();
    this.syncFarView();
    this.prepareFarWaterDepth();
    this.prepareWaterDepth();
    this.composer.render(0);
    this.shadowMapInvalid = false;
    if (
      !this.postcard &&
      this.hud &&
      this.marks.children.some((mark) => mark.visible)
    ) {
      // EffectPass ends on the default framebuffer. Rebuild only depth with the
      // same loaded near geometry/caps; the unlit marks then test that depth.
      // No screen-space AO/outline filter or private framebuffer access.
      this.renderer.setRenderTarget(null);
      const oldAutoClear = this.renderer.autoClear;
      try {
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.depthScene, this.camera);
        this.renderer.render(this.marks, this.camera);
      } finally {
        this.renderer.autoClear = oldAutoClear;
      }
    }
  }
  private prepareWaterDepth(): void {
    this.terrain.uniforms.waterDepthReady.value = 0;
    // Match Three's conservative sphere culling. Uploaded groups have not
    // necessarily reached their first render, so refresh their world matrices.
    if (this.camera.parent === null && this.camera.matrixWorldAutoUpdate)
      this.camera.updateMatrixWorld();
    this.waterFrustum.setFromProjectionMatrix(
      this.waterViewProjection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
      this.camera.coordinateSystem,
      this.camera.reversedDepth,
    );
    let hasFluid = false;
    for (const chunk of this.chunks.values()) {
      const fluid = chunk.fluid;
      if (
        chunk.worldId === this.worldId &&
        chunk.group.visible &&
        fluid?.visible
      ) {
        fluid.updateWorldMatrix(true, false);
        if (!fluid.frustumCulled || this.waterFrustum.intersectsObject(fluid)) {
          hasFluid = true;
          break;
        }
      }
    }
    if (!hasFluid) return;
    const oldTarget = this.renderer.getRenderTarget(),
      oldAutoClear = this.renderer.autoClear;
    if (oldTarget === this.waterDepthTarget)
      throw new Error("Water depth target must not be the active scene target");
    waterDepthRange(
      this.camera.near,
      this.camera.far,
      this.terrain.uniforms.waterDepthLinearize.value,
    );
    try {
      this.renderer.autoClear = true;
      this.renderer.setRenderTarget(this.waterDepthTarget);
      // Only opaque/cutout/lava geometry is present; it cannot sample the water
      // texture attached to this framebuffer. Cleared depth1 represents sky.
      this.renderer.render(this.depthScene, this.camera);
    } finally {
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.autoClear = oldAutoClear;
    }
    this.terrain.uniforms.waterDepthReady.value = 1;
  }
  get statistics(): { draws: number; triangles: number; memory: number } {
    let memory = this.terrain.texture.image.data?.byteLength ?? 0;
    memory += this.waterDepthTarget.width * this.waterDepthTarget.height * 8;
    memory +=
      this.farWaterDepthTarget.width * this.farWaterDepthTarget.height * 8;
    memory +=
      this.farPreparationTarget.width * this.farPreparationTarget.height * 8;
    for (const resource of this.farResources.values()) {
      const stats = resource.world.renderer.statistics(
        this.renderer.extensions.has("WEBGL_multi_draw"),
      );
      // Geometry has both CPU recovery arrays and a GPU copy; retained runs are CPU only.
      memory += stats.geometryBytes * 2 + stats.runBytes;
      memory += resource.coverage.mask.value.image.data?.byteLength ?? 0;
    }
    memory += this.ibaraEffects.statistics.memory;
    for (const c of this.chunks.values()) memory += c.gpuBytes;
    return {
      draws: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      memory,
    };
  }
  async capturePng(): Promise<Blob> {
    if (this.contextLost) throw new Error("WebGL context lost");
    this.render();
    this.render();
    return new Promise((resolve, reject) =>
      this.canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas capture failed"))),
        "image/png",
      ),
    );
  }
  dispose(): void {
    for (const world of [...this.farResources.keys()]) this.releaseFar(world);
    this.atmosphere?.clear();
    this.drawnEffectTextures?.forEach((texture) => {
      texture.dispose();
    });
    this.drawnEffectTextures?.clear();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    for (const chunk of [...this.chunks.values()])
      this.removeWorld(chunk.worldId);
    this.avatar.dispose();
    this.effects.dispose();
    this.ibaraEffects?.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as Material).dispose();
    this.depthMaterial.dispose();
    this.borderMaterial.dispose();
    for (const m of this.terrain.materials) m.dispose();
    this.terrain.texture.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.waterDepthTarget.dispose();
    this.farWaterDepthTarget.dispose();
    this.farPreparationTarget.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
