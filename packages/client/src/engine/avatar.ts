import {
  BoxGeometry,
  Color,
  type ColorRepresentation,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from "three";
import type { BodyState } from "../game/controller.js";
import { ease } from "./motion.js";

const pixel = 1.8 / 32;
type AvatarPart = Mesh<BoxGeometry, MeshLambertMaterial>;
export class Avatar {
  readonly group = new Group();
  readonly silhouette = new Group();
  readonly depth = new Group();
  private readonly head = new Group();
  private readonly limbs: Group[] = [];
  private readonly all: AvatarPart[] = [];
  private readonly copies: {
    original: AvatarPart;
    silhouette: Mesh;
    outline: Mesh;
    depth: Mesh;
  }[] = [];
  private readonly outlineScale = new Matrix4();
  private stepOffset = 0;
  private stepTime = 0;
  private armStart = -10000;
  constructor(steel: ColorRepresentation, ink: ColorRepresentation) {
    const skin = new MeshLambertMaterial({ color: new Color("#c09b78") }),
      coat = new MeshLambertMaterial({ color: new Color("#46596a") }),
      pants = new MeshLambertMaterial({ color: new Color("#303d48") }),
      hair = new MeshLambertMaterial({ color: new Color("#403a32") });
    const part = (
      w: number,
      h: number,
      d: number,
      material: MeshLambertMaterial,
      group: Group,
      x: number,
      y: number,
      z = 0,
    ): AvatarPart => {
      const mesh = new Mesh(
        new BoxGeometry(w * pixel, h * pixel, d * pixel),
        material,
      );
      mesh.position.set(x * pixel, y * pixel, z * pixel);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.all.push(mesh);
      return mesh;
    };
    part(8, 12, 4, coat, this.group, 0, 18);
    this.head.position.y = 24 * pixel;
    this.group.add(this.head);
    part(8, 8, 8, skin, this.head, 0, 4);
    part(8.05, 2, 8.05, hair, this.head, 0, 7.05);
    // Eyes are generated geometry, not a borrowed skin or remote texture.
    part(1, 1, 0.12, pants, this.head, -2, 4.2, -4.08);
    part(1, 1, 0.12, pants, this.head, 2, 4.2, -4.08);
    for (let i = 0; i < 4; i++) {
      const arm = i < 2,
        pivot = new Group();
      pivot.position.set(
        (i % 2 === 0 ? -1 : 1) * (arm ? 6 : 2) * pixel,
        (arm ? 24 : 12) * pixel,
        0,
      );
      this.group.add(pivot);
      this.limbs.push(pivot);
      part(4, 12, 4, arm ? coat : pants, pivot, 0, -6);
      if (arm) part(4.05, 3, 4.05, skin, pivot, 0, -10.5);
    }
    const silhouetteMaterial = new MeshBasicMaterial({
      color: steel,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });
    const depthMaterial = new MeshBasicMaterial({ colorWrite: false });
    const outlineMaterial = new MeshBasicMaterial({
      color: ink,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });
    for (const original of this.all) {
      const silhouette = new Mesh(original.geometry, silhouetteMaterial),
        outline = new Mesh(original.geometry, outlineMaterial),
        depth = new Mesh(original.geometry, depthMaterial);
      silhouette.matrixAutoUpdate = false;
      outline.matrixAutoUpdate = false;
      // All expanded black parts draw before all steel parts: their union leaves
      // only the outer rim, without wireframe lines inside the flat silhouette.
      outline.renderOrder = -2;
      silhouette.renderOrder = -1;
      depth.matrixAutoUpdate = false;
      this.silhouette.add(outline, silhouette);
      this.depth.add(depth);
      this.copies.push({ original, silhouette, outline, depth });
    }
  }
  swing(displayMs: number): void {
    this.armStart = displayMs;
  }
  step(rise: number, displayMs: number): void {
    if (rise > 0) {
      this.stepOffset = rise;
      this.stepTime = displayMs;
    }
  }
  update(
    body: BodyState,
    previous: BodyState,
    alpha: number,
    displayMs: number,
    outlineWidth: number,
  ): void {
    const t = Math.max(0, Math.min(1, alpha)),
      step =
        this.stepOffset *
        (1 - ease("ease-out", (displayMs - this.stepTime) / 100));
    this.group.position.set(
      previous.x + (body.x - previous.x) * t,
      previous.y + (body.y - previous.y) * t - step,
      previous.z + (body.z - previous.z) * t,
    );
    this.group.rotation.set(
      body.swimming
        ? -Math.PI / 2
        : body.sprinting
          ? -Math.PI / 18
          : body.sneaking
            ? -0.22
            : 0,
      -body.yaw,
      0,
    );
    if (body.sneaking) this.group.position.y -= 0.18;
    const phase = body.walkDistance * 2.5,
      amplitude = body.sprinting ? 0.9 : body.sneaking ? 0.25 : 0.65;
    const moving = Math.hypot(body.vx, body.vz) > 0.005;
    for (let i = 0; i < 4; i++) {
      const limb = this.limbs[i] as Group;
      limb.rotation.x = moving
        ? Math.sin(phase + (i % 2) * Math.PI) * amplitude * (i < 2 ? -1 : 1)
        : Math.sin((displayMs / 3000) * Math.PI * 2) * (i < 2 ? 0.025 : 0);
      if (body.flying && i >= 2) limb.rotation.x = 0.2;
      if (body.swimming)
        limb.rotation.x = Math.sin(displayMs / 240 + i * Math.PI) * 0.7;
    }
    const swing = (displayMs - this.armStart) / 300;
    if (swing >= 0 && swing < 1)
      (this.limbs[1] as Group).rotation.x = -Math.sin(swing * Math.PI) * 1.5;
    this.head.rotation.y = -(body.headYaw - body.yaw);
    this.group.updateMatrixWorld(true);
    for (const c of this.copies) {
      c.silhouette.matrix.copy(c.original.matrixWorld);
      const { width, height, depth } = c.original.geometry.parameters;
      this.outlineScale.makeScale(
        1 + (2 * outlineWidth) / width,
        1 + (2 * outlineWidth) / height,
        1 + (2 * outlineWidth) / depth,
      );
      c.outline.matrix.copy(c.original.matrixWorld).multiply(this.outlineScale);
      c.depth.matrix.copy(c.original.matrixWorld);
    }
  }
  dispose(): void {
    const materials = new Set(this.all.map((m) => m.material));
    for (const m of this.all) m.geometry.dispose();
    for (const m of materials) if (!Array.isArray(m)) m.dispose();
    const copy = this.copies[0];
    if (copy) {
      (copy.silhouette.material as MeshBasicMaterial).dispose();
      (copy.outline.material as MeshBasicMaterial).dispose();
      (copy.depth.material as MeshBasicMaterial).dispose();
    }
  }
}
