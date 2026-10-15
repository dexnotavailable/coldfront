import {
  type BoxGeometry,
  Color,
  type ColorRepresentation,
  DataTexture,
  Group,
  type Mesh,
  MeshLambertMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import type { BodyState } from "../game/controller.js";

/** Visual identity only. The controller and its 0.6 × 1.8 m box stay unchanged. */
export interface KingAppearance {
  kind: "king";
  kingdomColor: ColorRepresentation;
  kingdomAccent: ColorRepresentation;
  skin?: ColorRepresentation;
  hair?: ColorRepresentation;
}

/** Caller-supplied world-space wind. Strength is normalised to 0…1. */
export interface KingWind {
  x: number;
  z: number;
  strength: number;
}

export const KING_PIXEL = 1.8 / 32;
export const KING_CLOAK = Object.freeze({
  lengths: [4, 4, 4, 3.5] as const,
  // Stay inside the arms. Only the short, tapered tail widens below the hands.
  widths: [7.7, 7.7, 7.7, 11.7] as const,
  attachment: [0, 23.25, 3] as const,
  thickness: 0.18,
  transitionMs: 220,
  foldDegrees: 24,
});
const radians = Math.PI / 180;
const stillWind: KingWind = Object.freeze({ x: 0, z: 0, strength: 0 });

export interface KingCloakPose {
  upperPitch: number;
  middlePitch: number;
  lowerPitch: number;
  tipPitch: number;
  sway: number;
  fold: number;
}

interface CloakDrive {
  drape: number;
  movement: number;
  side: number;
  rear: number;
  wind: number;
}

function cloakDrive(body: BodyState, wind: KingWind): CloakDrive {
  const strength = Number.isFinite(wind.strength)
      ? Math.max(0, Math.min(1, wind.strength))
      : 0,
    magnitude = Math.hypot(wind.x, wind.z),
    validDirection = Number.isFinite(magnitude) && magnitude > 0,
    wx = validDirection ? wind.x / magnitude : 0,
    wz = validDirection ? wind.z / magnitude : 0,
    side = (wx * Math.cos(body.yaw) + wz * Math.sin(body.yaw)) * strength,
    rear = (-wx * Math.sin(body.yaw) + wz * Math.cos(body.yaw)) * strength,
    speed = Math.hypot(body.vx, body.vz),
    movement = Math.min(1, Math.max(0, (speed - 0.005) / 0.2)),
    drape = body.swimming
      ? 25
      : body.flying
        ? 24
        : body.sprinting
          ? 29
          : body.sneaking
            ? 18
            : 14 + 12 * movement;
  return { drape, movement, side, rear, wind: validDirection ? strength : 0 };
}

function poseFromDrive(drive: CloakDrive, displayMs: number): KingCloakPose {
  const seconds = displayMs / 1000,
    // Footfall-driven airflow exists in still air. Waves travel down the cloth;
    // the upper attachment moves least, and the free hem responds last.
    gait = seconds * 6.2,
    wind = seconds * 2.1,
    wave = (delay: number): number =>
      Math.sin(gait - delay) * drive.movement +
      Math.sin(wind - delay * 0.8) * drive.wind * 0.65,
    upper = drive.drape + drive.rear * 2 + wave(0) * 0.7;
  return {
    // Negative X tilts a downward panel away from the back (+Z).
    upperPitch: -upper * radians,
    // A restrained S-shaped fall exposes differently lit faces from above.
    middlePitch: -(8 + wave(0.9) * 1.3) * radians,
    lowerPitch: (12 - wave(1.8) * 1.8) * radians,
    tipPitch: -(6 + wave(2.7) * 2.3) * radians,
    sway:
      (drive.side * (3 + Math.sin(wind) * 1.5) +
        Math.sin(gait - 2) * drive.movement * 1.2) *
      radians,
    fold:
      (Math.sin(gait - 1.2) * drive.movement +
        Math.sin(wind + 0.5) * drive.wind) *
      1.3 *
      radians,
  };
}

/** Stateless settled pose for fixed-time studies and numerical bounds. */
export function kingCloakPose(
  body: BodyState,
  displayMs: number,
  wind: KingWind = stillWind,
): KingCloakPose {
  return poseFromDrive(cloakDrive(body, wind), displayMs);
}

/** Analytic state-change easing, with no timestep integration or wall clock. */
export function createKingCloakMotion(): {
  sample(body: BodyState, displayMs: number, wind?: KingWind): KingCloakPose;
} {
  let start = 0,
    lastTime = Number.NEGATIVE_INFINITY,
    from: CloakDrive | undefined,
    target: CloakDrive | undefined,
    lastPose: KingCloakPose | undefined;
  const fields = ["drape", "movement", "side", "rear", "wind"] as const;
  function at(time: number): CloakDrive {
    const t = Math.min(
        1,
        Math.max(0, (time - start) / KING_CLOAK.transitionMs),
      ),
      eased = t * t * (3 - 2 * t),
      value = { ...(target as CloakDrive) };
    for (const field of fields)
      value[field] =
        (from as CloakDrive)[field] +
        (value[field] - (from as CloakDrive)[field]) * eased;
    return value;
  }
  return {
    sample(body, displayMs, wind = stillWind) {
      // Repeated/paused timestamps cannot accumulate motion or consume changes.
      if (displayMs === lastTime && lastPose) return lastPose;
      const next = cloakDrive(body, wind);
      if (!target || displayMs < lastTime) {
        from = target = next;
        start = displayMs;
      } else if (fields.some((field) => next[field] !== target?.[field])) {
        from = at(displayMs);
        target = next;
        start = displayMs;
      }
      lastTime = displayMs;
      lastPose = poseFromDrive(at(displayMs), displayMs);
      return lastPose;
    },
  };
}

type KingPart = Mesh<BoxGeometry, MeshLambertMaterial>;
interface AttachmentRig {
  root: Group;
  head: Group;
  limbs: readonly Group[];
  part(
    w: number,
    h: number,
    d: number,
    material: MeshLambertMaterial,
    group: Group,
    x: number,
    y: number,
    z?: number,
  ): KingPart;
}

/** A fixed-seed, low-contrast 16² tile; no DOM/canvas or remote asset needed. */
function tile(
  base: ColorRepresentation,
  trim?: ColorRepresentation,
  accent?: ColorRepresentation,
  hem = false,
  width = 8,
  height = 6,
  edge: "both" | "left" | "right" | "none" = "both",
  cloth = false,
): DataTexture {
  const data = new Uint8Array(16 * 16 * 4),
    baseColor = new Color(base).convertLinearToSRGB(),
    trimColor =
      trim === undefined ? baseColor : new Color(trim).convertLinearToSRGB(),
    accentColor =
      accent === undefined
        ? trimColor
        : new Color(accent).convertLinearToSRGB();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const seed = ((x * 37 + y * 71 + 109) ^ (x * y * 13)) >>> 0,
        border =
          trim !== undefined &&
          (((edge === "both" || edge === "left") && x < 10 / width) ||
            ((edge === "both" || edge === "right") && x >= 16 - 10 / width)),
        bottom = trim !== undefined && hem && y < 9 / height,
        color = bottom ? accentColor : border ? trimColor : baseColor,
        tone =
          cloth && !border && !bottom
            ? Math.max(
                0.92,
                Math.min(
                  1.08,
                  (x < 4 ? 0.94 : x < 11 ? 1.04 : 1) +
                    (seed % 19 === 0 ? -0.015 : seed % 23 === 0 ? 0.015 : 0),
                ),
              )
            : trim === undefined
              ? 0.94 + (Math.floor(x / 4) % 3) * 0.03
              : seed % 19 === 0
                ? 0.94
                : seed % 23 === 0
                  ? 1.06
                  : 1,
        offset = (y * 16 + x) * 4;
      data[offset] = Math.min(255, Math.round(color.r * tone * 255));
      data[offset + 1] = Math.min(255, Math.round(color.g * tone * 255));
      data[offset + 2] = Math.min(255, Math.round(color.b * tone * 255));
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, 16, 16, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function attachKing(
  rig: AttachmentRig,
  appearance: KingAppearance,
): {
  update(body: BodyState, displayMs: number, wind: KingWind): void;
  dispose(): void;
} {
  const textures: DataTexture[] = [],
    material = (texture: DataTexture): MeshLambertMaterial => {
      textures.push(texture);
      return new MeshLambertMaterial({ map: texture });
    },
    crown = material(tile("#d8b765")),
    trim = material(tile(appearance.kingdomColor)),
    clasp = material(tile(appearance.kingdomAccent)),
    namedPart = (
      name: string,
      ...args: Parameters<AttachmentRig["part"]>
    ): KingPart => {
      const mesh = rig.part(...args);
      mesh.name = name;
      return mesh;
    };
  // Open 8.5 px aperture. The hair remains visible between four broad teeth.
  namedPart("king-crown-front", 10, 1, 0.75, crown, rig.head, 0, 7.5, -4.625);
  namedPart("king-crown-back", 10, 1, 0.75, crown, rig.head, 0, 7.5, 4.625);
  for (const side of [-1, 1]) {
    namedPart(
      `king-crown-side-${side}`,
      0.75,
      1,
      8.5,
      crown,
      rig.head,
      side * 4.625,
      7.5,
    );
    for (const back of [-1, 1])
      namedPart(
        `king-crown-tooth-${side}-${back}`,
        1.5,
        2,
        1.5,
        crown,
        rig.head,
        side * 4.25,
        9,
        back * 4.25,
      );
  }
  namedPart("king-clasp", 1.5, 1.5, 0.3, clasp, rig.root, 0, 22.8, -2.2);
  for (let i = 0; i < 2; i++)
    namedPart(
      `king-cuff-${i}`,
      4.1,
      1,
      4.1,
      trim,
      rig.limbs[i] as Group,
      0,
      -8.5,
    );
  // Three longitudinal folds, each flexing across four short sections.
  // The outer gores taper only below the hands; no full-width rigid hem bar.
  const motion = createKingCloakMotion(),
    columnWidth = KING_CLOAK.widths[0] / 3,
    foldAngle = KING_CLOAK.foldDegrees * radians,
    gores = [-1, 0, 1].map((side) => {
      const joints = KING_CLOAK.lengths.map(() => new Group()),
        width = columnWidth + 0.14,
        edge = side < 0 ? "left" : side > 0 ? "right" : "none",
        cloth = material(
          tile(
            "#303d48",
            appearance.kingdomColor,
            appearance.kingdomAccent,
            false,
            width,
            4,
            edge,
            true,
          ),
        ),
        hem = material(
          tile(
            "#303d48",
            appearance.kingdomColor,
            appearance.kingdomAccent,
            true,
            width,
            3.5,
            edge,
            true,
          ),
        );
      for (let i = 0; i < joints.length; i++) {
        const joint = joints[i] as Group,
          length =
            (KING_CLOAK.lengths[i] as number) -
            (i === 3 ? Math.abs(side) * 0.45 : 0),
          suffix = side === 0 ? `${i}` : `${i}-wing-${side}`;
        joint.name = `king-cloak-joint-${suffix}`;
        if (i === 0) {
          joint.position.set(
            side * columnWidth * KING_PIXEL,
            KING_CLOAK.attachment[1] * KING_PIXEL,
            (KING_CLOAK.attachment[2] +
              (Math.abs(side) * Math.sin(foldAngle) * width) / 2) *
              KING_PIXEL,
          );
          rig.root.add(joint);
        } else {
          joint.position.y =
            -(KING_CLOAK.lengths[i - 1] as number) * KING_PIXEL;
          (joints[i - 1] as Group).add(joint);
        }
        const mesh = namedPart(
          `king-cloak-panel-${suffix}`,
          width,
          length,
          KING_CLOAK.thickness,
          i === 3 ? hem : cloth,
          joint,
          0,
          -length / 2,
        );
        if (i === 3 && side !== 0) {
          const positions = mesh.geometry.attributes.position;
          if (positions)
            for (let vertex = 0; vertex < positions.count; vertex++) {
              if (
                positions.getY(vertex) < 0 &&
                positions.getX(vertex) * side > 0
              )
                positions.setX(
                  vertex,
                  positions.getX(vertex) +
                    ((side * (KING_CLOAK.widths[3] - KING_CLOAK.widths[2])) /
                      2) *
                      KING_PIXEL,
                );
            }
          mesh.geometry.computeVertexNormals();
        }
      }
      return { side, joints };
    });
  return {
    update(body, displayMs, wind) {
      const pose = motion.sample(body, displayMs, wind),
        pitches = [
          pose.upperPitch,
          pose.middlePitch,
          pose.lowerPitch,
          pose.tipPitch,
        ];
      for (const { side, joints } of gores)
        for (let i = 0; i < joints.length; i++)
          (joints[i] as Group).rotation.set(
            (pitches[i] as number) + side * pose.fold * (i / 3) * 0.22,
            i === 0 ? -side * foldAngle : 0,
            i === 3 ? pose.sway : 0,
          );
    },
    dispose() {
      for (const texture of textures) texture.dispose();
    },
  };
}
