export const MOTION_CURVES = Object.freeze({
  "ease-out": [0.22, 1, 0.36, 1],
  "ease-in": [0.64, 0, 0.78, 0],
  "ease-move": [0.65, 0, 0.35, 1],
  "ease-camera": [0.61, 1, 0.88, 1],
} as const);
export function follow(
  value: number,
  target: number,
  dt: number,
  tau: number,
): number {
  return value + (target - value) * (1 - Math.exp(-dt / tau));
}
export function ease(
  name: keyof typeof MOTION_CURVES,
  progress: number,
): number {
  const [x1, y1, x2, y2] = MOTION_CURVES[name],
    x = Math.max(0, Math.min(1, progress));
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let low = 0,
    high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (cubic(mid, x1, x2) < x) low = mid;
    else high = mid;
  }
  return cubic((low + high) / 2, y1, y2);
}
export class GameClocks {
  displayMs = 0;
  worldSeconds = 1200;
  paused = false;
  runs = true;
  get hours(): number {
    return this.worldSeconds <= 2400
      ? 6 + this.worldSeconds / 200
      : (18 + (this.worldSeconds - 2400) / 100) % 24;
  }
  setHours(hours: number): void {
    const h = ((hours % 24) + 24) % 24;
    this.worldSeconds =
      h >= 6 && h <= 18
        ? (h - 6) * 200
        : 2400 + ((h < 6 ? h + 24 : h) - 18) * 100;
  }
  step(dt: number): void {
    if (this.paused) return;
    this.displayMs += dt * 1000;
    if (this.runs) this.worldSeconds = (this.worldSeconds + dt) % 3600;
  }
}
