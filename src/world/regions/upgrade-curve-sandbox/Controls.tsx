/**
 * Bench panel: preset chips, the ladder toggle (shipped 0–3 / dream 0–5
 * what-if), the three pip rows with per-level costs, a delta ledger against
 * stock, and the JSON export of tuned constants. Writes the module-level
 * `bench` so the R3F skidpad reads the fit without re-rendering its loop.
 */
import { useMemo, useState } from 'react';
import {
  PHYS, STOCK, PRESETS, KMH, HUNDRED_MS,
  computeMetrics, levelCost, maxLevel, totalSunk,
  exportPayload, AVG_MISSION_CR,
  type Ladder, type Pips, type PartKey, type Metrics,
} from './physics';

const PARTS: { key: PartKey; name: string; moves: string }[] = [
  { key: 'engine', name: 'Engine coils', moves: `accel +${PHYS.accPerEngine}/lvl · cap +${PHYS.vmaxPerEngine}/lvl` },
  { key: 'handling', name: 'Gyro cage', moves: `steer +${PHYS.steerPerHandling}/lvl · grip +1.6/lvl` },
  { key: 'boost', name: 'Boost cell', moves: `drain −${PHYS.drainPerBoost}/lvl · regen +${PHYS.regenPerBoost}/lvl` },
];

const fmtSec = (v: number | null, ceilingKmh?: number) =>
  v === null ? `never · ${Math.round(ceilingKmh ?? 0)} cap` : `${v.toFixed(2)} s`;

function fmtDelta(cur: number | null, stock: number | null, unit: string, invert = false): { s: string; cls: string } {
  if (cur === null || stock === null) return { s: '—', cls: '' };
  const d = cur - stock;
  if (Math.abs(d) < 0.005) return { s: '±0', cls: '' };
  const better = invert ? d < 0 : d > 0;
  return { s: `${d > 0 ? '+' : ''}${d.toFixed(unit === 's' ? 2 : unit === '%' ? 0 : 1)}${unit}`, cls: better ? 'up' : 'down' };
}

/* --------------------------------------------------------- delta ledger */

function DeltaLedger({ m, stock }: { m: Metrics; stock: Metrics }) {
  const rows: { label: string; cur: string; ref: string; delta: { s: string; cls: string } }[] = [
    {
      label: '0→100 km/h · boost tape',
      cur: fmtSec(m.launch.t100), ref: fmtSec(stock.launch.t100),
      delta: fmtDelta(m.launch.t100, stock.launch.t100, 's', true),
    },
    {
      label: '0→100 km/h · throttle only',
      cur: fmtSec(m.cruise.t100, m.topKmh), ref: fmtSec(stock.cruise.t100, stock.topKmh),
      delta: fmtDelta(m.cruise.t100, stock.cruise.t100, 's', true),
    },
    {
      label: 'top speed · throttle / boost',
      cur: `${m.topKmh.toFixed(1)} / ${m.topKmhBoost.toFixed(1)}`,
      ref: `${stock.topKmh.toFixed(1)} / ${stock.topKmhBoost.toFixed(1)}`,
      delta: fmtDelta(m.topKmhBoost, stock.topKmhBoost, ''),
    },
    {
      label: 'boost hold / refill',
      cur: `${m.holdS.toFixed(2)} / ${m.refillS.toFixed(1)} s`,
      ref: `${stock.holdS.toFixed(2)} / ${stock.refillS.toFixed(1)} s`,
      delta: fmtDelta(m.holdS, stock.holdS, 's'),
    },
    {
      label: 'boost duty cycle',
      cur: `${(m.duty * 100).toFixed(1)}%`, ref: `${(stock.duty * 100).toFixed(1)}%`,
      delta: fmtDelta(m.duty * 100, stock.duty * 100, '%'),
    },
    {
      label: 'turn rate @ 60 km/h',
      cur: `${m.steer60.toFixed(0)}°/s`, ref: `${stock.steer60.toFixed(0)}°/s`,
      delta: fmtDelta(m.steer60, stock.steer60, ''),
    },
    {
      label: 'drift-exit kick cap',
      cur: `${PHYS.kickCap} impulse`, ref: `${PHYS.kickCap} impulse`,
      delta: { s: '±0 · free', cls: '' },
    },
  ];
  return (
    <table className="ucs-ledger">
      <thead>
        <tr><th scope="col">measure</th><th scope="col">this fit</th><th scope="col">stock</th><th scope="col">Δ</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.cur}</td>
            <td className="dim">{r.ref}</td>
            <td className={`ucs-delta ${r.delta.cls}`}>{r.delta.s}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -------------------------------------------------------------- panel */

export interface BenchPanelProps {
  pips: Pips;
  ladder: Ladder;
  onPips: (p: Pips) => void;
  onLadder: (l: Ladder) => void;
}

export function BenchPanel({ pips, ladder, onPips, onLadder }: BenchPanelProps) {
  const [copied, setCopied] = useState(false);
  const m = useMemo(() => computeMetrics(pips, ladder), [pips, ladder]);
  const stock = useMemo(() => computeMetrics(STOCK, 'shipped'), []);
  const maxL = maxLevel(ladder);
  const payload = useMemo(() => exportPayload(pips, ladder, m, stock), [pips, ladder, m, stock]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    if (p.dream && ladder !== 'dream') onLadder('dream');
    onPips({ ...p.pips });
  };

  const pickLadder = (l: Ladder) => {
    onLadder(l);
    if (l === 'shipped') {
      // clamp the fit back onto the shipped ladder
      onPips({ engine: Math.min(3, pips.engine), handling: Math.min(3, pips.handling), boost: Math.min(3, pips.boost) });
    }
  };

  return (
    <div className="ucs-bench panel">
      <div className="ucs-bench-row ucs-presets">
        {PRESETS.filter((p) => !p.dream || ladder === 'dream').map((p) => {
          const active = p.pips.engine === pips.engine && p.pips.handling === pips.handling && p.pips.boost === pips.boost;
          return (
            <button
              key={p.id}
              className={`ucs-chip${active ? ' active' : ''}`}
              title={p.note}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          );
        })}
        <span className="ucs-ladder-toggle" role="group" aria-label="ladder length">
          {(['shipped', 'dream'] as const).map((l) => (
            <button
              key={l}
              className={`ucs-chip small${ladder === l ? ' active' : ''}${l === 'dream' ? ' dream' : ''}`}
              title={l === 'dream' ? 'What-if: extrapolate the same gains to level 5, cost ×2 each step past 1800' : 'The ladder the game ships today'}
              onClick={() => pickLadder(l)}
            >
              {l === 'shipped' ? 'shipped 0–3' : 'dream 0–5'}
            </button>
          ))}
        </span>
      </div>

      {PARTS.map((part) => (
        <section key={part.key} className="ucs-part">
          <div className="ucs-part-head">
            <strong>{part.name}</strong>
            <span className="ucs-part-moves">{part.moves}</span>
          </div>
          <div className="ucs-pips" role="group" aria-label={`${part.name} level`}>
            {Array.from({ length: maxL + 1 }, (_, lvl) => {
              const dream = lvl > 3;
              const active = pips[part.key] === lvl;
              return (
                <span key={lvl} className="ucs-pip-cell">
                  <button
                    className={`ucs-pip${active ? ' active' : ''}${dream ? ' dream' : ''}`}
                    aria-pressed={active}
                    aria-label={`${part.name} level ${lvl}${lvl > 0 ? ` for ${levelCost(ladder, lvl).toLocaleString()} credits` : ' (stock)'}`}
                    onClick={() => onPips({ ...pips, [part.key]: lvl })}
                  >
                    {lvl}
                  </button>
                  <i className="ucs-pip-cost">{lvl === 0 ? 'stock' : `${levelCost(ladder, lvl).toLocaleString()}`}</i>
                </span>
              );
            })}
          </div>
        </section>
      ))}

      <div className="ucs-sunk">
        sunk <b>{totalSunk(ladder, pips).toLocaleString()} cr</b>
        <span className="dim"> · ≈{(totalSunk(ladder, pips) / AVG_MISSION_CR).toFixed(1)} deliveries at the {AVG_MISSION_CR} cr board average</span>
        {ladder === 'dream' && <em className="ucs-dream-note">dream ladder — same linear gains, ×2 cost. Not shipped.</em>}
      </div>

      <DeltaLedger m={m} stock={stock} />

      <div className="ucs-bench-row">
        <button
          className="ucs-chip"
          onClick={() => {
            void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? '✓ copied' : '⧉ export constants JSON'}
        </button>
        <details className="ucs-payload">
          <summary>peek at the payload</summary>
          <pre>{JSON.stringify(payload, null, 1)}</pre>
        </details>
      </div>

      <p className="ucs-fine">
        Constants mirror <code>Bike.tsx</code> exactly (accel {PHYS.accBase}+{PHYS.accPerEngine}e,
        cap {PHYS.vmaxBase}+{PHYS.vmaxPerEngine}e, drag exp(−{PHYS.drag}·dt), display factor ×{KMH}).
        Flat salt, grip 1, throttle pinned. The hundred-line sits at {HUNDRED_MS.toFixed(1)} m/s.
        Cargo shield isn't on these curves — it soaks, it doesn't move.
      </p>
    </div>
  );
}
