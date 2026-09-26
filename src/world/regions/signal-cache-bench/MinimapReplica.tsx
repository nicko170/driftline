/**
 * SIGNAL CACHE SCOUT BENCH — minimap replica.
 *
 * A faithful, standalone re-draw of drawMinimap() from src/ui/HUD.tsx at 2×
 * resolution: translucent ink disc, ochre region blob, the open lore-violet
 * diamonds for uncollected caches (rgba(154,134,208,0.9), 3.6 px half-size,
 * 1.4 px stroke — doubled here), the mission-colour reference markers
 * (amber diamond, teal square, rust triangle), the salt player arrow, plus
 * one bench addition: a dashed violet ring at the 340 m hail cutoff so you
 * can see stations drop out of the feed. Redrawn only when the ladder
 * changes; CVD simulation is handled by the compositor filter on the stage.
 */
import { useEffect, useRef } from 'react';
import {
  FAMILY_POSITIONS, MINIMAP, SHIPPED, stationPositions, type BenchConfig,
} from './spec';

export function MinimapReplica({ cfg }: { cfg: BenchConfig }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const S = canvas.width;
    const scale = (S / 2 - 10) / 840; // bench window: 840 m from centre

    ctx.clearRect(0, 0, S, S);
    // ink disc (game: rgba(20,16,31,0.72))
    ctx.fillStyle = `rgba(20, 16, 31, ${MINIMAP.bgAlpha})`;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    const px = (wx: number) => S / 2 + wx * scale;
    const pz = (wz: number) => S / 2 + wz * scale;

    // ochre region blob, like the HUD's region circles
    ctx.beginPath();
    ctx.arc(px(0), pz(-380), 300 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(176, 124, 58, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(176, 124, 58, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // bench addition: dashed violet hail ring at 340 m
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, SHIPPED.hintRange * scale, 0, Math.PI * 2);
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(154, 134, 208, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // mission reference markers (game shapes, exact colours)
    for (const { pos, id } of FAMILY_POSITIONS) {
      const sx = px(pos[0]);
      const sy = pz(pos[1]);
      if (id === 'objective') {
        ctx.fillStyle = '#FFB454';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
      } else if (id === 'convoy') {
        ctx.fillStyle = '#57C4B8';
        ctx.fillRect(sx - 5.5, sy - 5.5, 11, 11);
      } else {
        ctx.fillStyle = '#E4572E';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 9);
        ctx.lineTo(sx + 7.5, sy + 6.5);
        ctx.lineTo(sx - 7.5, sy + 6.5);
        ctx.closePath();
        ctx.fill();
      }
    }

    // uncollected caches — open violet diamonds, exact game styling ×2
    ctx.strokeStyle = `rgba(154, 134, 208, ${MINIMAP.diamondAlpha})`;
    ctx.lineWidth = MINIMAP.lineWidth * 2;
    const half = MINIMAP.halfPx * 2;
    for (const [x, z] of stationPositions(cfg.ladder)) {
      const sx = px(x);
      const sy = pz(z);
      ctx.beginPath();
      ctx.moveTo(sx, sy - half);
      ctx.lineTo(sx + half, sy);
      ctx.lineTo(sx, sy + half);
      ctx.lineTo(sx - half, sy);
      ctx.closePath();
      ctx.stroke();
    }

    // player arrow (salt), fixed at centre — the rider sits at the range head
    ctx.fillStyle = '#F3EEE2';
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2 - 12);
    ctx.lineTo(S / 2 + 8, S / 2 + 10);
    ctx.lineTo(S / 2 - 8, S / 2 + 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [cfg.ladder]);

  return (
    <canvas
      ref={ref}
      width={304}
      height={304}
      className="scb-minimap"
      role="img"
      aria-label="Minimap replica: open violet diamonds mark the cache stations, the dashed violet ring is the 340 metre hail cutoff, amber teal and rust markers are the mission family for comparison"
    />
  );
}
