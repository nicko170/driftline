/**
 * First-frame beacon: mounts inside the Canvas <Suspense> tree and fires once
 * the first real frame has rendered (i.e. shaders compiled, world visible).
 * The departure screen uses it as the "LAMPS LIT" manifest stamp.
 */
import { useFrame } from '@react-three/fiber';

let fired = false;
const subs = new Set<() => void>();

/** Subscribe to the first rendered frame. Fires immediately if it already happened. */
export function onFirstFrame(cb: () => void): () => void {
  if (fired) {
    cb();
    return () => {};
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

/** Mount once inside <Suspense>. */
export function FrameBeacon(): null {
  useFrame(() => {
    if (fired) return;
    fired = true;
    for (const cb of subs) cb();
    subs.clear();
  });
  return null;
}
