import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  Plane,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { EARLY_SMITHY } from "../../../../shared/src/assets/structures/early-smithy.js";
import { Block } from "../../../../shared/src/blocks/registry.js";
import { generateTextureArray } from "../../../../shared/src/blocks/textures/recipes.js";

/** Presentation parts only. Neither these leaves nor stations provide gameplay. */
export class SmithyParts {
  readonly group = new Group();
  readonly depth = new Group();
  readonly doors: readonly Group[];
  readonly clip = new Plane(new Vector3(0, -1, 0), 100000);
  private readonly survey = { value: 0 };
  private readonly ownedTextures: DataTexture[] = [];
  private readonly ownedMaterials: (MeshLambertMaterial | MeshBasicMaterial)[] =
    [];
  private readonly geometry: BufferGeometry[] = [];
  private readonly depthCopies: { original: Mesh; copy: Mesh }[] = [];

  constructor(skyAt: (x: number, y: number, z: number) => number = () => 1) {
    this.group.name = "smithy-future-gameplay-parts";
    const generated = generateTextureArray();
    const pixels = (block: number, top = false): Uint8Array => {
      const offset = (block * 6 + (top ? 3 : 0)) * 256 * 4;
      return generated.data.slice(offset, offset + 256 * 4);
    };
    // Finished iron is deliberately a local rigid-part finish, never a BlockId.
    const iron = new Uint8Array(16 * 16 * 4);
    const ramp = [
      [74, 80, 85],
      [80, 86, 91],
      [85, 91, 96],
      [89, 95, 100],
    ];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const tone = ramp[
          ((x * 17 + y * 31 + (x ^ y) * 7) >>> 1) % 4
        ] as number[];
        const i = (y * 16 + x) * 4;
        iron.set(
          [tone[0] as number, tone[1] as number, tone[2] as number, 255],
          i,
        );
      }
    const material = (data: Uint8Array): MeshLambertMaterial => {
      const map = new DataTexture(data, 16, 16);
      map.colorSpace = SRGBColorSpace;
      map.magFilter = map.minFilter = NearestFilter;
      map.wrapS = map.wrapT = RepeatWrapping;
      map.needsUpdate = true;
      this.ownedTextures.push(map);
      const m = new MeshLambertMaterial({
        map,
        color: new Color(1, 1, 1),
        clippingPlanes: [this.clip],
        clipShadows: true,
      });
      m.customProgramCacheKey = () => "smithy-parts-terrain-light-v1";
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uSmithySurvey = this.survey;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vSmithyWorld;\nvarying float vSmithySky;\nattribute float smithySky;",
        );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSmithyWorld=(modelMatrix*vec4(position,1.0)).xyz;\nvSmithySky=smithySky;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <common>",
          "#include <common>\nuniform float uSmithySurvey;\nvarying vec3 vSmithyWorld;\nvarying float vSmithySky;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "outgoingLight *= max(0.13 + vSmithySky*0.87,uSmithySurvey);\noutgoingLight += diffuseColor.rgb*uSmithySurvey*0.38;\n#include <opaque_fragment>",
        );
        // Match the production terrain's distance + height fog, without lights.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <fog_fragment>",
          `
#ifdef USE_FOG
float distanceFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
float heightFog=1.0-exp(-vFogDepth*fogDensity*0.25*exp(-max(vSmithyWorld.y,0.0)*0.025));
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(max(distanceFog,heightFog),0.0,1.0));
#endif`,
        );
      };
      this.ownedMaterials.push(m);
      return m;
    };
    const wood = material(pixels(Block.Planks));
    const end = material(pixels(Block.Log, true));
    const log = material(pixels(Block.Log));
    const metal = material(iron);
    const depthMaterial = new MeshBasicMaterial({
      colorWrite: false,
      clippingPlanes: [this.clip],
    });
    this.ownedMaterials.push(depthMaterial);
    const part = (
      name: string,
      dims: readonly [number, number, number],
      at: readonly [number, number, number],
      surface: MeshLambertMaterial | MeshLambertMaterial[],
      parent = this.group,
    ): Mesh => {
      const geometry = new BoxGeometry(...dims);
      this.geometry.push(geometry);
      const uv = geometry.getAttribute("uv");
      for (let face = 0; face < 6; face++) {
        const u = face < 2 ? dims[2] : dims[0];
        const v = face === 2 || face === 3 ? dims[2] : dims[1];
        for (let corner = 0; corner < 4; corner++) {
          const i = face * 4 + corner;
          uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
        }
      }
      const mesh = new Mesh(geometry, surface);
      mesh.name = name;
      mesh.position.set(...at);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      const copy = new Mesh(geometry, depthMaterial);
      copy.matrixAutoUpdate = false;
      this.depth.add(copy);
      this.depthCopies.push({ original: mesh, copy });
      return mesh;
    };
    const doors: Group[] = [];
    for (const [index, anchor] of EARLY_SMITHY.doors.entries()) {
      const pivot = new Group();
      pivot.name = `door-${index}-outward-pivot`;
      pivot.position.set(anchor.pivot[0], anchor.pivot[1], anchor.pivot[2]);
      this.group.add(pivot);
      doors.push(pivot);
      const x = (anchor.direction * anchor.width) / 2;
      part(
        `door-${index}-leaf`,
        [anchor.width, 3, 0.125],
        [x, 1.5, 0],
        wood,
        pivot,
      );
      for (const y of [0.45, 2.5])
        part(
          `door-${index}-strap-${y}`,
          [anchor.width - 0.12, 0.1, 0.04],
          [x, y, -0.081],
          metal,
          pivot,
        );
    }
    this.doors = doors;
    part(
      "anvil-stump",
      [0.72, 0.35, 0.8],
      [1.75, 0.175, 11.4],
      [log, log, end, end, log, log],
    );
    part("anvil-foot", [0.66, 0.09, 0.76], [1.75, 0.395, 11.4], metal);
    part("anvil-waist", [0.32, 0.29, 0.46], [1.75, 0.585, 11.4], metal);
    part("anvil-shoulder", [0.46, 0.08, 0.86], [1.75, 0.77, 11.4], metal);
    part("anvil-face", [0.56, 0.14, 1.04], [1.75, 0.88, 11.4], metal);
    part("anvil-horn-root", [0.36, 0.14, 0.24], [1.75, 0.85, 12.02], metal);
    part("anvil-square-horn", [0.22, 0.1, 0.24], [1.75, 0.83, 12.26], metal);
    part("bench-top", [0.75, 0.15, 2], [1.375, 0.825, 4], wood);
    for (const x of [1.125, 1.625])
      for (const z of [3.15, 4.85])
        part("bench-leg", [0.18, 0.75, 0.18], [x, 0.375, z], log);
    part("bench-stretcher", [0.15, 0.12, 1.7], [1.375, 0.3, 4], wood);
    this.setDoorPose(1);
    // Static part lighting samples the real solved skylight at each face vertex.
    this.group.updateMatrixWorld(true);
    for (const { original } of this.depthCopies) {
      const positions = original.geometry.getAttribute("position");
      const normals = original.geometry.getAttribute("normal");
      const values = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i++) {
        const point = new Vector3()
          .fromBufferAttribute(positions, i)
          .addScaledVector(new Vector3().fromBufferAttribute(normals, i), 0.03)
          .applyMatrix4(original.matrixWorld);
        values[i] = Math.max(0, Math.min(1, skyAt(point.x, point.y, point.z)));
      }
      original.geometry.setAttribute(
        "smithySky",
        new Float32BufferAttribute(values, 1),
      );
    }
  }

  /** Static demonstration pose, not interactive doors or collision. 0 shut, 1 open. */
  setDoorPose(open: number): void {
    const t = Math.max(0, Math.min(1, open));
    this.doors.forEach((door, i) => {
      door.rotation.y = ((i === 0 ? 1 : -1) * t * Math.PI) / 2;
    });
    this.syncDepth();
  }
  setCut(worldY: number): void {
    this.clip.constant = Number.isFinite(worldY) ? worldY : 100000;
    this.survey.value = Number.isFinite(worldY) ? 0.42 : 0;
  }
  syncDepth(): void {
    this.group.updateMatrixWorld(true);
    for (const { original, copy } of this.depthCopies)
      copy.matrix.copy(original.matrixWorld);
  }
  dispose(): void {
    for (const item of this.geometry) item.dispose();
    for (const item of this.ownedMaterials) item.dispose();
    for (const item of this.ownedTextures) item.dispose();
    this.group.removeFromParent();
    this.depth.removeFromParent();
  }
}
