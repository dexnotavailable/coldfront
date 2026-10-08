/** Current phase1.1 world bindings. Bootstrap adds the six shell bindings. */
export const WORLD_CODES = Object.freeze({
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  sneak: "ShiftLeft",
  sprint: "ControlLeft",
  turnLeft: "ArrowLeft",
  turnRight: "ArrowRight",
  tiltUp: "ArrowUp",
  tiltDown: "ArrowDown",
  slower: "BracketLeft",
  faster: "BracketRight",
} as const);
export const WORLD_BUTTONS = Object.freeze({
  attack: 0,
  use: 2,
  pick: 1,
} as const);
export const WORLD_BINDINGS = Object.freeze([
  { id: "key.pos.forward", code: WORLD_CODES.forward },
  { id: "key.pos.back", code: WORLD_CODES.back },
  { id: "key.pos.left", code: WORLD_CODES.left },
  { id: "key.pos.right", code: WORLD_CODES.right },
  { id: "key.pos.jump", code: WORLD_CODES.jump },
  { id: "key.pos.sneak", code: WORLD_CODES.sneak },
  { id: "key.pos.sprint", code: WORLD_CODES.sprint },
  { id: "key.pos.attack", button: WORLD_BUTTONS.attack },
  { id: "key.pos.use", button: WORLD_BUTTONS.use },
  { id: "key.pos.pick", button: WORLD_BUTTONS.pick },
  { id: "key.pos.turn-left", code: WORLD_CODES.turnLeft },
  { id: "key.pos.turn-right", code: WORLD_CODES.turnRight },
  { id: "key.pos.tilt-up", code: WORLD_CODES.tiltUp },
  { id: "key.pos.tilt-down", code: WORLD_CODES.tiltDown },
  { id: "key.own.slower", code: WORLD_CODES.slower },
  { id: "key.own.faster", code: WORLD_CODES.faster },
] as const);
