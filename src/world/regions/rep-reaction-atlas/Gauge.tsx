/**
 * RepGauge — the amber needle gauge. A semicircular dial per faction column:
 * posture arcs (same rail colours as the ledger bench), boundary ticks at
 * 0 / 15 / 40 / 80, and a warm amber needle pinned at the standing. The value
 * and the band chip live in DOM around it — the SVG never carries meaning
 * alone (canvas/SVG convey, DOM says).
 */
import { BANDS, GAUGE_MAX, GAUGE_MIN, type Band } from './data';

const CX = 110;
const CY = 112;
const R_ARC = 86;

/** Standing → dial degrees (0 = right, 180 = left; semicircle). */
const degFor = (v: number) => 180 - ((v - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 180;

const rad = (d: number) => (d * Math.PI) / 180;

function polar(v: number, r: number): [number, number] {
  const a = rad(degFor(v));
  return [CX + Math.cos(a) * r, CY - Math.sin(a) * r];
}

function arcPath(v0: number, v1: number): string {
  const [x0, y0] = polar(v0, R_ARC);
  const [x1, y1] = polar(v1, R_ARC);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R_ARC} ${R_ARC} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export default function RepGauge({ value, band, color }: { value: number; band: Band; color: string }) {
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, value));
  const [tx, ty] = polar(clamped, R_ARC - 20);
  const ticks = [0, 15, 40, 80];
  return (
    <div
      className="rra-gauge"
      role="meter"
      aria-valuemin={GAUGE_MIN}
      aria-valuemax={GAUGE_MAX}
      aria-valuenow={value}
      aria-label={`standing ${value}, ${band.label.toLowerCase()} band`}
    >
      <svg viewBox="0 0 220 128" aria-hidden="true">
        {/* posture arcs — the active band burns, the rest smoulder */}
        {BANDS.map((b) => {
          const v0 = Math.max(GAUGE_MIN, b.min === -Infinity ? GAUGE_MIN : b.min);
          const v1 = Math.min(GAUGE_MAX, b.until ?? GAUGE_MAX);
          return (
            <path
              key={b.id}
              d={arcPath(v0, v1)}
              fill="none"
              stroke={b.color}
              strokeWidth={b.id === band.id ? 11 : 7}
              opacity={b.id === band.id ? 0.95 : 0.28}
              strokeLinecap="butt"
            />
          );
        })}
        {/* boundary ticks */}
        {ticks.map((t) => {
          const [x0, y0] = polar(t, R_ARC - 9);
          const [x1, y1] = polar(t, R_ARC + 9);
          return (
            <g key={t}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#E4D7BE" strokeOpacity={0.45} strokeWidth={1} />
              <text x={polar(t, R_ARC + 17)[0]} y={polar(t, R_ARC + 17)[1]} className="rra-gauge-tick" textAnchor="middle">
                {t}
              </text>
            </g>
          );
        })}
        {/* needle */}
        <line x1={CX} y1={CY} x2={tx} y2={ty} stroke="#FFC969" strokeWidth={3} strokeLinecap="round" />
        <line
          x1={CX + (CX - tx) * 0.18}
          y1={CY + (CY - ty) * 0.18}
          x2={CX}
          y2={CY}
          stroke="#FFC969"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.7}
        />
        <circle cx={CX} cy={CY} r={7} fill="#14101F" stroke={color} strokeWidth={2} />
        {/* glass hint */}
        <path d={arcPath(GAUGE_MIN + 30, GAUGE_MAX - 24)} fill="none" stroke="#F3EEE2" strokeOpacity={0.06} strokeWidth={R_ARC / 5} />
      </svg>
    </div>
  );
}
