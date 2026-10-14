import {
  BoxGeometry,
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
import { HEARTHLANDS_HOUSE } from "../../../../shared/src/assets/structures/hearthlands-house.js";
import { Block } from "../../../../shared/src/blocks/registry.js";
import {
  generateTextureArray,
  LAYERS_PER_BLOCK,
} from "../../../../shared/src/blocks/textures/recipes.js";

const aperture = HEARTHLANDS_HOUSE.pendingParts.door;
const jambGap = 0.04;
const verticalGap = 0.02;
const thickness = 0.08;
const frontGap = 0.02;

/** Visual join clearances only; these do not change the voxel doorway. */
export const HOUSE_DOOR = Object.freeze({
  aperture,
  material: Block.Planks,
  width: aperture.max[0] - aperture.min[0] - 2 * jambGap,
  height: aperture.max[1] - aperture.min[1] - 2 * verticalGap,
  thickness,
  hinge: Object.freeze([
    aperture.min[0] + jambGap,
    aperture.min[1] + verticalGap,
    aperture.min[2] - frontGap - thickness / 2,
  ] as const),
  poses: Object.freeze({ closed: 0, open: 1 }),
  openAngle: Math.PI / 2,
});

/** One presentation leaf. No collision, interaction, timing or enclosure state. */
export class HouseDoor {
  readonly group = new Group();
  readonly depth = new Group();
  readonly hinge = new Group();
  readonly clip = new Plane(new Vector3(0, -1, 0), 100000);
  readonly leaf: Mesh<BoxGeometry, MeshLambertMaterial>;
  private readonly depthLeaf: Mesh<BoxGeometry, MeshBasicMaterial>;
  private readonly texture: DataTexture;
  private readonly material: MeshLambertMaterial;
  private readonly depthMaterial: MeshBasicMaterial;
  private readonly geometry: BoxGeometry;

  constructor(
    private readonly skyAt: (x: number, y: number, z: number) => number = () =>
      1,
  ) {
    this.group.name = "house-presentation-door";
    this.depth.name = "house-presentation-door-depth";
    this.hinge.name = "house-door-outward-pivot";
    this.hinge.position.set(...HOUSE_DOOR.hinge);
    this.group.add(this.hinge);
    const generated = generateTextureArray();
    // Existing plank side, variant zero; retain its 16-pixel-per-metre scale.
    const offset = Block.Planks * LAYERS_PER_BLOCK * 16 * 16 * 4;
    this.texture = new DataTexture(
      generated.data.slice(offset, offset + 16 * 16 * 4),
      16,
      16,
    );
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = NearestFilter;
    this.texture.wrapS = this.texture.wrapT = RepeatWrapping;
    this.texture.needsUpdate = true;
    this.material = new MeshLambertMaterial({
      map: this.texture,
      vertexColors: true,
      clippingPlanes: [this.clip],
      clipShadows: true,
    });
    // Match the current terrain's distance/height fog, using the actual world
    // position. Sun, ambient light, exposure and postprocessing remain renderer
    // owned; this prop creates no lights, emission or cut-view brightness boost.
    this.material.customProgramCacheKey = () => "house-door-fog-v1";
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHouseDoorWorld;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHouseDoorWorld=(modelMatrix*vec4(position,1.0)).xyz;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vHouseDoorWorld;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `
#ifdef USE_FOG
float distanceFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
float heightFog=1.0-exp(-vFogDepth*fogDensity*0.25*exp(-max(vHouseDoorWorld.y,0.0)*0.025));
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(max(distanceFog,heightFog),0.0,1.0));
#endif`,
      );
    };
    this.geometry = new BoxGeometry(
      HOUSE_DOOR.width,
      HOUSE_DOOR.height,
      HOUSE_DOOR.thickness,
    );
    const uv = this.geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      const width = face < 2 ? HOUSE_DOOR.thickness : HOUSE_DOOR.width;
      const height =
        face === 2 || face === 3 ? HOUSE_DOOR.thickness : HOUSE_DOOR.height;
      uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height);
    }
    this.leaf = new Mesh(this.geometry, this.material);
    this.leaf.name = "house-door-plank-leaf";
    this.leaf.position.set(HOUSE_DOOR.width / 2, HOUSE_DOOR.height / 2, 0);
    this.leaf.castShadow = this.leaf.receiveShadow = true;
    this.hinge.add(this.leaf);
    this.depthMaterial = new MeshBasicMaterial({
      colorWrite: false,
      clippingPlanes: [this.clip],
    });
    this.depthLeaf = new Mesh(this.geometry, this.depthMaterial);
    this.depthLeaf.name = "house-door-depth-leaf";
    this.depthLeaf.matrixAutoUpdate = false;
    this.depth.add(this.depthLeaf);
    this.setOpen(HOUSE_DOOR.poses.closed);
  }

  /** Static pose: 0 shut, 1 outward by 90 degrees. No automatic animation. */
  setOpen(amount: number): void {
    if (!Number.isFinite(amount))
      throw new RangeError("Finite door pose required");
    this.hinge.rotation.y =
      Math.max(0, Math.min(1, amount)) * HOUSE_DOOR.openAngle;
    this.sync();
  }

  setCut(worldY: number): void {
    this.clip.constant = Number.isFinite(worldY) ? worldY : 100000;
  }

  /** Call after changing the assembly origin; depth uses world-space matrices. */
  sync(): void {
    this.group.updateMatrixWorld(true);
    this.depthLeaf.matrix.copy(this.leaf.matrixWorld);
    this.depth.updateMatrixWorld(true);
    const positions = this.geometry.getAttribute("position");
    const normals = this.geometry.getAttribute("normal");
    const colours = new Float32Array(positions.count * 3);
    const point = new Vector3();
    const normal = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      normal
        .fromBufferAttribute(normals, i)
        .transformDirection(this.leaf.matrixWorld);
      point
        .fromBufferAttribute(positions, i)
        .applyMatrix4(this.leaf.matrixWorld)
        .addScaledVector(normal, 0.03);
      const sample = this.skyAt(point.x, point.y, point.z);
      const sky = Number.isFinite(sample)
        ? Math.max(0, Math.min(1, sample))
        : 0;
      const shade = 0.13 + sky * 0.87;
      colours.set([shade, shade, shade], i * 3);
    }
    this.geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  }

  dispose(): void {
    this.group.removeFromParent();
    this.depth.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
    this.texture.dispose();
  }
}
