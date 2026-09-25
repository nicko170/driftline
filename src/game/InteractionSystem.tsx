/**
 * Proximity interactions inside the canvas: job board, garage, and future
 * interactables. Writes telemetry.interact; consumes the interact key.
 */
import { useFrame } from '@react-three/fiber';
import { getAnchor } from '../world/registry';
import { telemetry } from '../telemetry';
import { consume } from '../input/input';
import { audio } from '../audio/audio';
import { useGameStore } from '../state/store';

const SPOTS: { ref: string; kind: 'board' | 'garage'; label: string }[] = [
  { ref: 'saltmouth:job-board', kind: 'board', label: 'Job board' },
  { ref: 'saltmouth:garage', kind: 'garage', label: "Ketch's garage" },
];

const RADIUS = 15;

export default function InteractionSystem() {
  useFrame(() => {
    const game = useGameStore.getState();
    if (game.mode !== 'riding') {
      telemetry.interact = null;
      return;
    }
    let best: { kind: 'board' | 'garage'; label: string } | null = null;
    let bestD = RADIUS * RADIUS;
    for (const spot of SPOTS) {
      const a = getAnchor(spot.ref);
      if (!a) continue;
      const d2 = (a.x - telemetry.x) ** 2 + (a.z - telemetry.z) ** 2;
      if (d2 < bestD && telemetry.speed < 14) {
        bestD = d2;
        best = { kind: spot.kind, label: spot.label };
      }
    }
    telemetry.interact = best;
    if (best && consume('interact')) {
      audio.resume();
      audio.blip(760, 0.08);
      game.setMode(best.kind);
    }
  });
  return null;
}
