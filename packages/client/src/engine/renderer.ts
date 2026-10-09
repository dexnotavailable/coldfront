import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
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
  EdgesGeometry,
  FogExp2,
  Group,
  HalfFloatType,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Scene,
  SRGBColorSpace,
  UnsignedIntType,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { SunLight } from "three/addons/lights/SunLight.js";
import { Sky } from "three/addons/objects/Sky.js";
import type { MeshPart } from "../../../shared/src/meshing/greedy.js";
import type { ToolState } from "../contracts/game-ui.js";
import type { BodyState } from "../game/controller.js";
import type { BlockHit, Point } from "../game/raycast.js";
import { Avatar } from "./avatar.js";
import { CutCap } from "./cut-cap.js";
import { BlockEffects } from "./effects.js";
import { createTerrainMaterials, waterDepthRange } from "./terrain-material.js";
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
  readonly hasFluid: boolean;
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
  readonly avatar: Avatar;
  readonly effects = new BlockEffects();
  readonly rayPoint = new Vector3();
  private readonly chunks = new Map<string, RenderChunk>();
  private readonly clip = new Plane(new Vector3(0, -1, 0), 100000);
  private readonly terrain = createTerrainMaterials(this.clip);
  private readonly waterDepthTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly sun = new SunLight(0xffebcf, 2.4);
  private readonly ambient = new HemisphereLight(0xc1d3e3, 0x777363, 1.2);
  private readonly sky = new Sky();
  private readonly skyDay = { value: 1 };
  private readonly fog = new FogExp2(0xaab5b4, 0.004);
  private readonly composer: EffectComposer;
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
  private ready = false;
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
    this.setSkyUniform("cloudDensity", 0);
    this.sky.scale.setScalar(4500);
    this.setSkyUniform("turbidity", 3);
    this.setSkyUniform("rayleigh", 1.5);
    this.setSkyUniform("mieCoefficient", 0.004);
    this.setSkyUniform("mieDirectionalG", 0.8);
    this.scene.add(this.sky);
    this.sky.material.uniforms.uDay = this.skyDay;
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace("void main()", "uniform float uDay;\nvoid main()")
      .replace(
        "gl_FragColor = vec4( texColor, 1.0 );",
        `
      ivec3 starCell=ivec3(floor(direction*900.0));
      uint starHash=uint(starCell.x)*0x9e3779b1u ^ uint(starCell.y)*0x85ebca77u ^ uint(starCell.z)*0xc2b2ae3du;
      starHash^=starHash>>16u; starHash*=0x7feb352du; starHash^=starHash>>15u;
      float star=(starHash&4095u)==0u && direction.y>0.08 ? 0.55 : 0.0;
      vec3 nightSky=mix(vec3(0.028,0.045,0.078),vec3(0.009,0.017,0.037),max(0.0,direction.y))+star;
      gl_FragColor = vec4(mix(nightSky,texColor,uDay),1.0);`,
      );
    this.avatar = new Avatar(colors.steel, colors.ink);
    this.scene.add(this.avatar.group);
    this.depthScene.add(this.avatar.depth);
    this.marks.add(this.avatar.silhouette);
    this.scene.add(this.effects.particles, this.effects.pop);
    this.marks.add(this.effects.ghost);
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
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      intensity: 0.2,
      luminanceThreshold: 8,
      luminanceSmoothing: 0.05,
      mipmapBlur: true,
    });
    this.composer.addPass(
      new EffectPass(
        this.camera,
        bloom,
        new ToneMappingEffect({
          mode: ToneMappingMode.ACES_FILMIC,
          adaptive: false,
        }),
      ),
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    canvas.addEventListener("webglcontextlost", this.lost);
    canvas.addEventListener("webglcontextrestored", this.restored);
  }
  private lost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.terrain.uniforms.waterDepthReady.value = 0;
    this.onLost();
  };
  private restored = (): void => {
    this.contextLost = false;
    this.ready = false;
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
    let bytes = 0;
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
        part.indices.byteLength;
      const mesh = new Mesh(g, this.terrain.materials[index]);
      mesh.castShadow = index < 2;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (index < 2) depth.add(new Mesh(g, this.depthMaterial));
    });
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
    this.chunks.set(key, {
      worldId: result.world.id,
      group,
      depth,
      cap,
      depthCap,
      border,
      geometries,
      gpuBytes: bytes + 32768,
      hasFluid: (result.mesh.parts[3]?.indices.length ?? 0) > 0,
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
  }
  setWorld(worldId: number): void {
    this.worldId = worldId;
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
    for (const key of [...this.chunks.keys()])
      if (key.startsWith(`${worldId}:`))
        this.remove(key.slice(key.indexOf(":") + 1), worldId);
  }
  /** Draw every destination mesh into an offscreen target before atomic commit.
   * Compile alone does not upload vertex/index buffers. This preserves the visible
   * source framebuffer and detects a lost context or failed destination draw. */
  prepareView(worldId: number, position: Point, focus: Point): void {
    if (this.contextLost)
      throw new Error("WebGL context lost during view preparation");
    const oldWorld = this.worldId,
      oldPosition = this.camera.position.clone(),
      oldQuaternion = this.camera.quaternion.clone(),
      oldWaterDepthReady = this.terrain.uniforms.waterDepthReady.value;
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
      this.setView(position, focus);
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
      this.renderer.render(this.scene, this.camera);
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
      this.setWorld(oldWorld);
    }
  }
  setView(position: Point, focus: Point): void {
    this.camera.position.set(position.x, position.y, position.z);
    // Sky is a4500m box. Keep the camera inside it everywhere in the45km world;
    // its shader derives the ray from worldPosition-cameraPosition.
    this.sky.position.copy(this.camera.position);
    this.camera.lookAt(focus.x, focus.y, focus.z);
    this.camera.updateMatrixWorld();
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
  ): void {
    this.cut = cut;
    this.clip.constant = Number.isFinite(cut) ? cut : 100000;
    this.terrain.uniforms.cut.value = this.clip.constant;
    this.terrain.uniforms.display.value = displayMs;
    this.terrain.uniforms.origin.value.set(
      Math.floor((this.postcard ? this.camera.position.x : body.x) / 1024) *
        1024,
      0,
      Math.floor((this.postcard ? this.camera.position.z : body.z) / 1024) *
        1024,
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
    this.effects.particles.visible = !this.postcard;
    this.effects.pop.visible &&= !this.postcard;
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
    this.fog.density = tools.fog ? 0.004 : 0;
    this.sun.shadow.intensity = tools.shadows ? 1 : 0;
    this.setTime(tools.timeHours);
  }
  private setSkyUniform(name: string, value: number | Vector3): void {
    const uniform = this.sky.material.uniforms[name];
    if (!uniform) throw new Error(`Missing Sky uniform: ${name}`);
    uniform.value = value;
  }
  setTime(hours: number): void {
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
    this.scene.background = this.fog.color;
    this.terrain.uniforms.night.value = 1 - day;
  }
  setHud(visible: boolean): void {
    this.hud = visible;
  }
  setPostcard(active: boolean): void {
    this.postcard = active;
    this.camera.fov = active ? 70 : 40;
    this.camera.updateProjectionMatrix();
    this.resize();
  }
  compile(): void {
    const saved: { object: { visible: boolean }; visible: boolean }[] = [];
    const sample = [...this.chunks.values()].find((c) => c.geometries.length)
      ?.geometries[0];
    const variants = sample
      ? this.terrain.materials.map((material) => new Mesh(sample, material))
      : [];
    this.scene.add(...variants);
    for (const object of [
      this.effects.pop,
      this.effects.ghost,
      this.avatar.silhouette,
      this.outline,
      ...[...this.chunks.values()].flatMap((c) => [c.cap.mesh, c.depthCap]),
    ]) {
      saved.push({ object, visible: object.visible });
      object.visible = true;
    }
    try {
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.depthScene, this.camera);
      this.renderer.compile(this.marks, this.camera);
      this.ready = true;
    } finally {
      for (const s of saved) s.object.visible = s.visible;
      this.scene.remove(...variants);
    }
  }
  render(): void {
    if (!this.ready || this.contextLost) return;
    this.renderer.info.reset();
    this.prepareWaterDepth();
    this.composer.render(0);
    if (!this.postcard && this.hud) {
      // EffectPass ends on the default framebuffer. Rebuild only depth with the
      // same loaded near geometry/caps; the unlit marks then test that depth.
      // No screen-space AO/outline filter or private framebuffer access.
      this.renderer.setRenderTarget(null);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.depthScene, this.camera);
      this.renderer.render(this.marks, this.camera);
      this.renderer.autoClear = true;
    }
  }
  private prepareWaterDepth(): void {
    this.terrain.uniforms.waterDepthReady.value = 0;
    let hasFluid = false;
    for (const chunk of this.chunks.values())
      if (
        chunk.worldId === this.worldId &&
        chunk.group.visible &&
        chunk.hasFluid
      ) {
        hasFluid = true;
        break;
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
      // Only opaque/cutout geometry is present here; it cannot sample the water
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
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    for (const chunk of [...this.chunks.values()])
      this.removeWorld(chunk.worldId);
    this.avatar.dispose();
    this.effects.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as Material).dispose();
    this.depthMaterial.dispose();
    this.borderMaterial.dispose();
    for (const m of this.terrain.materials) m.dispose();
    this.terrain.texture.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.waterDepthTarget.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
