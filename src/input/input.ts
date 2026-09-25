/**
 * Unified input: keyboard + gamepad + touch overlay all write into `input`.
 * Edge-triggered actions (hop/interact/pause) are consumed once by gameplay.
 */
export interface InputState {
  steer: number;    // -1 left .. +1 right
  throttle: number; // 0..1
  brake: number;    // 0..1 (held brake while steering = drift)
  boost: boolean;
  hop: boolean;     // edge: consume() clears
  interact: boolean;// edge
  pause: boolean;   // edge
}

export const input: InputState = {
  steer: 0,
  throttle: 0,
  brake: 0,
  boost: false,
  hop: false,
  interact: false,
  pause: false,
};

export function consume(key: 'hop' | 'interact' | 'pause'): boolean {
  if (!input[key]) return false;
  input[key] = false;
  return true;
}

const keys = new Set<string>();

const onKey = (e: KeyboardEvent, down: boolean) => {
  // ignore when typing in a field
  if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (down) {
    if (k === ' ') e.preventDefault();
    if (!keys.has(k)) {
      if (k === ' ') input.hop = true;
      if (k === 'e' || k === 'enter') input.interact = true;
      if (k === 'escape' || k === 'p') input.pause = true;
    }
    keys.add(k);
  } else keys.delete(k);
};

let bound = false;
export function bindInput(): void {
  if (bound) return;
  bound = true;
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());
}

/** Read keyboard state into `input` — call once per physics step before gamepad merge. */
export function pollKeyboard(): void {
  const k = keys;
  const steerL = k.has('a') || k.has('arrowleft') ? 1 : 0;
  const steerR = k.has('d') || k.has('arrowright') ? 1 : 0;
  input.steer = steerR - steerL;
  input.throttle = k.has('w') || k.has('arrowup') ? 1 : 0;
  input.brake = k.has('s') || k.has('arrowdown') ? 1 : 0;
  input.boost = k.has('shift');
}

/** Merge gamepad state (called every physics step; pad wins when deflected). */
export function pollGamepad(): void {
  const pads = navigator.getGamepads?.();
  if (!pads) return;
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (Math.abs(ax) > 0.12) input.steer = ax;
    if (Math.abs(ay) > 0.15) {
      if (ay < 0) input.throttle = Math.min(1, -ay);
      else input.brake = Math.min(1, ay);
    }
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    if (b(7)) input.throttle = Math.max(input.throttle, pad.buttons[7].value || 1);
    if (b(6)) input.brake = Math.max(input.brake, pad.buttons[6].value || 1);
    if (b(0)) input.hop = true;
    if (b(5) || b(2)) input.boost = true;
    if (b(1)) input.interact = true;
    if (b(9)) input.pause = true;
    break; // first connected pad wins
  }
}
