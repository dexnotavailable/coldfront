import {
  type ColorRepresentation,
  Data3DTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
} from "three";
import { capOccupancy } from "../../../shared/src/meshing/cap.js";

/** Exact cell occupancy, not material IDs: moving the cap only changes a uniform.
 * A plane fragment exists iff the containing loaded near voxel is solid. Thus
 * every cut solid is capped, all empty tunnel cells stay open, and no ore can be
 * disclosed. This is equivalent to the solid cross-section of closed cell cubes
 * including loaded edges; it does not depend on open greedy boundary topology.
 */
export class CutCap {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly texture: Data3DTexture;
  private readonly height = { value: 0 };
  constructor(
    blocks: Uint16Array,
    readonly cy: number,
    color: ColorRepresentation,
  ) {
    // Foundation order x,z,y: Data3D texture coordinate is therefore (x,z,y).
    const occupancy = capOccupancy(blocks);
    this.texture = new Data3DTexture(occupancy, 32, 32, 32);
    this.texture.format = RedFormat;
    this.texture.type = UnsignedByteType;
    this.texture.minFilter = NearestFilter;
    this.texture.magFilter = NearestFilter;
    this.texture.unpackAlignment = 1;
    this.texture.needsUpdate = true;
    const material = new MeshBasicMaterial({ color, toneMapped: false });
    material.customProgramCacheKey = () => "coldfront-occupancy-cap-v1";
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSolid = { value: this.texture };
      shader.uniforms.uLocalHeight = this.height;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vCapUV;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvCapUV=uv;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nprecision highp sampler3D;\nuniform sampler3D uSolid;\nuniform float uLocalHeight;\nvarying vec2 vCapUV;",
        )
        .replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif(texture(uSolid,vec3(vCapUV.x,1.0-vCapUV.y,(floor(uLocalHeight)+0.5)/32.0)).r<0.5) discard;",
        );
    };
    const geometry = new PlaneGeometry(32, 32);
    this.mesh = new Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
  }
  update(worldHeight: number): void {
    const local = worldHeight - this.cy * 32;
    this.mesh.visible = local >= 0 && local < 32;
    this.height.value = local;
    this.mesh.position.y = worldHeight;
  }
  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
