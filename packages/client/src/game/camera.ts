import { BLOCK_REGISTRY, Block } from "../../../shared/src/blocks/registry.js";
import { ease, follow } from "../engine/motion.js";
import type { BlockQuery, Point } from "./raycast.js";
export function wheelFactor(delta: number, mode: number): number {
  const pixels = delta * (mode === 1 ? 100 / 3 : mode === 2 ? 400 : 1);
  return Math.max(0.8, Math.min(1.25, Math.exp(0.0016 * pixels)));
}
export function commandTilt(distance: number, offset = 0): number {
  const d = [24, 120, 600, 2000, 6000],
    t = [35, 45, 58, 68, 80];
  let i = 0;
  while (i < 3 && distance > (d[i + 1] as number)) i++;
  const alpha = Math.max(
    0,
    Math.min(
      1,
      Math.log(distance / (d[i] as number)) /
        Math.log((d[i + 1] as number) / (d[i] as number)),
    ),
  );
  return Math.max(
    20,
    Math.min(
      89,
      (t[i] as number) +
        ((t[i + 1] as number) - (t[i] as number)) * alpha +
        offset,
    ),
  );
}
export class AutomaticCut {
  height = Infinity;
  private coveredFor = 0;
  private openFor = 0;
  private raisingFrom = 0;
  private raisingTo = 0;
  private raisingMs = 150;
  update(dt: number, body: Point, cameraY: number, get: BlockQuery): void {
    const roof = (x: number, z: number): number => {
      for (let y = Math.ceil(body.y + 1.8); y < cameraY; y++) {
        const id = get(x, y, z);
        if (id !== Block.Leaves && BLOCK_REGISTRY[id]?.solid) return y;
      }
      return Infinity;
    };
    const bx = Math.floor(body.x),
      bz = Math.floor(body.z),
      ownRoof = roof(bx, bz);
    if (ownRoof < Infinity) {
      this.coveredFor += dt;
      this.openFor = 0;
      let low = ownRoof;
      for (let z = -1; z <= 1; z++)
        for (let x = -1; x <= 1; x++) low = Math.min(low, roof(bx + x, bz + z));
      const target = low - 0.5;
      if (this.coveredFor >= 0.25 || this.height < Infinity) {
        if (target < this.height) {
          this.height = target;
          this.raisingTo = target;
          this.raisingMs = 150;
        } else if (target >= this.height + 1 && target !== this.raisingTo) {
          this.raisingFrom = this.height;
          this.raisingTo = target;
          this.raisingMs = 0;
        }
        if (this.raisingMs < 150) {
          this.raisingMs += dt * 1000;
          this.height =
            this.raisingFrom +
            (this.raisingTo - this.raisingFrom) *
              ease("ease-camera", this.raisingMs / 150);
        }
      }
    } else {
      this.coveredFor = 0;
      this.openFor += dt;
      if (this.openFor >= 0.5) {
        this.height = Infinity;
        this.raisingMs = 150;
      }
    }
  }
}
export class OverheadCamera {
  focus: Point = { x: 0, y: 7, z: 0 };
  position: Point = { x: 0, y: 27, z: 14 };
  distance = 24;
  requestedDistance = 24;
  yaw = 0;
  chosenTilt = 55;
  tilt = 55;
  readonly cut = new AutomaticCut();
  private snap: { from: number; to: number; time: number } | null = null;
  private cutTilt = { from: 55, to: 55, time: 300 };
  private underCover = false;
  zoom(factor: number): void {
    this.requestedDistance = Math.max(
      10,
      Math.min(400, this.requestedDistance * factor),
    );
  }
  orbit(dx: number, dy: number): void {
    this.snap = null;
    this.yaw -= dx * 0.25;
    this.chosenTilt = Math.max(20, Math.min(85, this.chosenTilt + dy * 0.2));
  }
  tapTurn(direction: number, startYaw: number): void {
    const units = startYaw / 45;
    const target =
      (direction > 0
        ? Math.floor(units + 1e-6) + 1
        : Math.ceil(units - 1e-6) - 1) * 45;
    this.snap = { from: this.yaw, to: target, time: 0 };
  }
  step(
    dt: number,
    body: Point,
    get: BlockQuery,
    surface: (x: number, z: number, cut: number) => number,
    turn: number,
    tiltInput: number,
  ): void {
    this.focus.x = follow(this.focus.x, body.x, dt, 0.1);
    this.focus.y = follow(this.focus.y, body.y + 1, dt, 0.1);
    this.focus.z = follow(this.focus.z, body.z, dt, 0.1);
    this.distance = follow(this.distance, this.requestedDistance, dt, 0.09);
    if (turn) {
      this.snap = null;
      this.yaw += turn * 100 * dt;
    }
    if (this.snap) {
      this.snap.time += dt;
      this.yaw =
        this.snap.from +
        (this.snap.to - this.snap.from) *
          ease("ease-camera", this.snap.time / 0.18);
      if (this.snap.time >= 0.18) this.snap = null;
    }
    this.chosenTilt = Math.max(
      20,
      Math.min(85, this.chosenTilt + tiltInput * 60 * dt),
    );
    this.cut.update(dt, body, this.position.y, get);
    const covered = this.cut.height < Infinity;
    const requested = covered ? Math.max(70, this.chosenTilt) : this.chosenTilt;
    if (covered !== this.underCover) {
      this.cutTilt = { from: this.tilt, to: requested, time: 0 };
      this.underCover = covered;
    } else this.cutTilt.to = requested;
    this.cutTilt.time += dt * 1000;
    this.tilt =
      this.cutTilt.time < 300
        ? this.cutTilt.from +
          (this.cutTilt.to - this.cutTilt.from) *
            ease("ease-camera", this.cutTilt.time / 300)
        : requested;
    const yaw = (this.yaw * Math.PI) / 180;
    const place = (tilt: number): Point => ({
      x:
        this.focus.x -
        Math.sin(yaw) * this.distance * Math.cos((tilt * Math.PI) / 180),
      y: this.focus.y + this.distance * Math.sin((tilt * Math.PI) / 180),
      z:
        this.focus.z +
        Math.cos(yaw) * this.distance * Math.cos((tilt * Math.PI) / 180),
    });
    let p = place(this.tilt);
    // Safety clearance is a hard floor; requested distance is never changed.
    for (
      let i = 0;
      i < 16 && p.y < surface(p.x, p.z, this.cut.height) + 6 && this.tilt < 85;
      i++
    ) {
      this.tilt = Math.min(85, this.tilt + 3);
      p = place(this.tilt);
    }
    const lift = Math.max(0, surface(p.x, p.z, this.cut.height) + 6 - p.y);
    p.y += lift;
    this.focus.y += lift;
    this.position = p;
  }
}
