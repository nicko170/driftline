/**
 * Cargo Shake Lab — control panel.
 *
 * Sliders drive the shipped damage chain (impact threshold → shield soak →
 * FRAGILE_DMG coefficient); the scatter chart shows every scripted impact as
 * (impulse → integrity loss) so you can see which hits even register under a
 * param set, and the payout chart plots 0.35 + 0.65 × integrity with every
 * sequence's predicted landing spot. "Stash A" pins a param set as the dashed
 * ghost so the current sliders can be A/B'd against it on the same
 * deterministic course. Copy JSON emits a MissionDirector tuning payload.
 */
import { useEffect, useState } from 'react';
import {
  lab, run, stats, findSeq, resolveHit, payoutOf, predictRun, soakOf,
  resetRun, startRun, stopRun, exportPayload,
  EVENTS, SEQUENCES, PRESETS, SHIP,
} from './sim';
import { synth } from './synth';

/* -------------------------------------------------------- scatter chart */

const W = 344;
const H = 148;
const ML = 34;
const MR = 8;
const MT = 8;
const MB = 18;

const IMP_MAX = 30;
const KIND_GLYPH: Record<string, string> = {
  rock: '▲ rock', graze: '● graze', clip: '■ clip', land: '◆ landing', gust: '✕ gust',
};
const KIND_CLASS: Record<string, string> = {
  rock: 'k-rock', graze: 'k-graze', clip: 'k-clip', land: 'k-land', gust: 'k-gust',
};

function Shape({ kind, x, y, cls }: { kind: string; x: number; y: number; cls: string }) {
  switch (kind) {
    case 'rock':
      return <path className={cls} d={`M ${x} ${y - 3.4} L ${x + 3.4} ${y + 2.6} L ${x - 3.4} ${y + 2.6} Z`} />;
    case 'clip':
      return <rect className={cls} x={x - 2.9} y={y - 2.9} width={5.8} height={5.8} />;
    case 'land':
      return <path className={cls} d={`M ${x} ${y - 3.8} L ${x + 3.8} ${y} L ${x} ${y + 3.8} L ${x - 3.8} ${y} Z`} />;
    case 'gust':
      return (
        <path className={`${cls} stroke-only`} d={`M ${x - 2.8} ${y - 2.8} L ${x + 2.8} ${y + 2.8} M ${x - 2.8} ${y + 2.8} L ${x + 2.8} ${y - 2.8}`} />
      );
    default:
      return <circle className={cls} cx={x} cy={y} r={3} />;
  }
}

function ScatterChart({ tick }: { tick: number }) {
  void tick; // parent bumps this when params/stash/seq change
  const seq = findSeq(lab.seq);
  const pts = EVENTS.filter((e) => !e.hop).map((e) => ({
    id: e.id,
    kind: e.kind,
    label: e.label,
    impulse: e.impulse,
    loss: resolveHit(e.impulse, lab.params).loss,
    stashLoss: lab.stash ? resolveHit(e.impulse, lab.stash).loss : null,
    inSeq: seq.events.includes(e.id),
  }));
  let maxLoss = 0.1;
  for (const p of pts) {
    maxLoss = Math.max(maxLoss, p.loss, p.stashLoss ?? 0);
  }
  maxLoss *= 1.15;

  const x = (imp: number) => ML + (imp / IMP_MAX) * (W - ML - MR);
  const y = (loss: number) => MT + (1 - loss / maxLoss) * (H - MT - MB);
  const thresholdX = x(lab.params.threshold);
  const damageFloor = lab.params.threshold + soakOf(lab.params);
  const grazeLineY = y(SHIP.GRAZE_FLOOR * lab.params.coef);

  return (
    <div className="csl-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Damage per impact: impulse against integrity loss">
        {/* soaked / sub-threshold zone — no damage at all */}
        <rect
          className="csl-soakzone"
          x={ML} y={MT}
          width={Math.max(0, Math.min(x(damageFloor), W - MR) - ML)}
          height={H - MT - MB}
        />
        {/* threshold + shield lines */}
        <line className="csl-chart-thresh" x1={thresholdX} y1={MT} x2={thresholdX} y2={H - MB} />
        {soakOf(lab.params) > 0 && damageFloor <= IMP_MAX && (
          <line className="csl-chart-soakline" x1={x(damageFloor)} y1={MT} x2={x(damageFloor)} y2={H - MB} />
        )}
        {/* graze floor: minimum registering hit */}
        <line className="csl-chart-graze" x1={ML} y1={grazeLineY} x2={W - MR} y2={grazeLineY} />
        <text className="csl-chart-note" x={W - MR - 2} y={grazeLineY - 3}>graze floor</text>

        {[0, 10, 20, 30].map((v) => (
          <text key={v} className="csl-chart-tick" x={x(v)} y={H - 5}>{v}</text>
        ))}
        <text className="csl-chart-tick" x={ML} y={MT + 7}>{maxLoss.toFixed(2)}</text>
        <text className="csl-chart-axis" x={(ML + W - MR) / 2} y={H - 5}>impact m/s →</text>

        {/* stashed ghost ring first (underneath) */}
        {lab.stash &&
          pts.map((p) =>
            p.stashLoss !== null ? (
              <circle key={`s-${p.id}`} className="csl-pt-stash" cx={x(p.impulse)} cy={y(p.stashLoss)} r={4.2}>
                <title>{`${p.label} (ghost A): ${(p.stashLoss * 100).toFixed(1)}% integrity`}</title>
              </circle>
            ) : null,
          )}
        {pts.map((p) => (
          <g key={p.id}>
            {p.inSeq && (
              <circle className="csl-pt-seqring" cx={x(p.impulse)} cy={y(p.loss)} r={6.4} />
            )}
            <Shape kind={p.kind} x={x(p.impulse)} y={y(p.loss)} cls={`csl-pt ${KIND_CLASS[p.kind] ?? ''}`} />
            <title>{`${p.label}: ${p.impulse.toFixed(1)} m/s → −${(p.loss * 100).toFixed(1)}% integrity`}</title>
          </g>
        ))}
      </svg>
      <div className="csl-chart-legend">
        {Object.entries(KIND_GLYPH).map(([k, g]) => (
          <span key={k} className={`csl-lg ${KIND_CLASS[k]}`}>{g}</span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- payout chart */

const PW = 344;
const PH = 112;
const PML = 34;
const PMR = 8;
const PMT = 8;
const PMB = 18;
const P_MIN = 0.3;
const P_MAX = 1.05;

function PayoutChart({ tick }: { tick: number }) {
  void tick;
  const px = (i: number) => PML + i * (PW - PML - PMR);
  const py = (p: number) => PMT + (1 - (p - P_MIN) / (P_MAX - P_MIN)) * (PH - PMT - PMB);
  const curvePts: string[] = [];
  for (let s = 0; s <= 32; s++) {
    const i = s / 32;
    curvePts.push(`${s === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(payoutOf(i)).toFixed(1)}`);
  }
  const seqMarks = SEQUENCES.map((seq) => {
    const p = predictRun(seq, lab.params);
    const g = lab.stash ? predictRun(seq, lab.stash) : null;
    return { id: seq.id, label: seq.label, p, g };
  });
  const liveI = lab.running ? run.integrity : null;

  return (
    <div className="csl-chart">
      <svg viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label="Payout multiplier against final cargo integrity">
        {/* fail band: integrity ~0 means the job failed before payout */}
        <rect className="csl-failzone" x={PML} y={PMT} width={px(0.07) - PML} height={PH - PMT - PMB} />
        <text className="csl-chart-note fail" x={PML + 3} y={PMT + 9}>shatter = fail</text>

        {[0, 0.5, 1].map((i) => (
          <text key={i} className="csl-chart-tick" x={px(i)} y={PH - 5}>{Math.round(i * 100)}%</text>
        ))}
        {[SHIP.PAYOUT_BASE, 1].map((p, k) => (
          <text key={k} className="csl-chart-tick" x={PML - 5} y={py(p) + 2.5} textAnchor="end">×{p.toFixed(2)}</text>
        ))}
        <text className="csl-chart-axis" x={(PML + PW - PMR) / 2} y={PH - 5}>final integrity →</text>

        <path className="csl-payout-curve" d={curvePts.join(' ')} />

        {/* ghost stash predictions */}
        {lab.stash &&
          seqMarks.map((m) =>
            m.g ? (
              <circle
                key={`g-${m.id}`}
                className={`csl-pt-stash ${m.g.shattered ? 'dead' : ''}`}
                cx={px(m.g.shattered ? 0.015 : m.g.integrity)}
                cy={py(payoutOf(m.g.integrity))}
                r={4}
              >
                <title>{`${m.label} (ghost A): ${m.g.shattered ? 'SHATTERED — job fails' : `${Math.round(m.g.integrity * 100)}% → ×${m.g.payout.toFixed(2)}`}`}</title>
              </circle>
            ) : null,
          )}
        {/* current param predictions */}
        {seqMarks.map((m) => {
          const sel = m.id === lab.seq;
          return (
            <g key={m.id}>
              {sel && (
                <circle
                  className="csl-pt-seqring"
                  cx={px(m.p.shattered ? 0.015 : m.p.integrity)}
                  cy={py(payoutOf(m.p.integrity))}
                  r={7.4}
                />
              )}
              <path
                className={`csl-pt k-land ${m.p.shattered ? 'dead' : ''}`}
                d={(() => {
                  const cx = px(m.p.shattered ? 0.015 : m.p.integrity);
                  const cy = py(payoutOf(m.p.integrity));
                  const r = sel ? 4.4 : 3.2;
                  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
                })()}
              >
                <title>{`${m.label}: ${m.p.shattered ? 'SHATTERED — job fails' : `${Math.round(m.p.integrity * 100)}% → ×${m.p.payout.toFixed(2)}`}`}</title>
              </path>
            </g>
          );
        })}
        {/* live integrity pointer while a run is up */}
        {liveI !== null && (
          <path
            className="csl-payout-live"
            d={`M ${px(Math.max(0.01, liveI))} ${PH - PMB + 4} L ${px(Math.max(0.01, liveI)) - 4} ${PH - PMB + 10} L ${px(Math.max(0.01, liveI)) + 4} ${PH - PMB + 10} Z`}
          />
        )}
      </svg>
      <div className="csl-chart-legend">
        <span className="csl-lg">— payout ×0.35+0.65·integrity</span>
        <span className="csl-lg k-land">◆ sequence prediction</span>
        {lab.stash && <span className="csl-lg stash">◯ ghost A</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- panel */

export function LabPanel() {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const bump = () => setTick((n) => n + 1);

  const [live, setLive] = useState({
    integrity: 1, payout: 1, running: false, fps: 0, seq: 'gauntlet',
    ghostOn: false, hasStash: false, muted: false, loop: true,
  });
  useEffect(() => {
    const iv = window.setInterval(
      () =>
        setLive({
          integrity: run.integrity,
          payout: payoutOf(run.integrity),
          running: lab.running,
          fps: stats.fps,
          seq: lab.seq,
          ghostOn: lab.ghostOn,
          hasStash: !!lab.stash,
          muted: lab.muted,
          loop: lab.loop,
        }),
      160,
    );
    return () => window.clearInterval(iv);
  }, []);

  if (!open) {
    return (
      <button className="csl-reopen" onClick={() => setOpen(true)}>
        ▣ cargo bench
      </button>
    );
  }

  const pickPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    lab.params = { ...p.p };
    synth.tick(920, 0.05);
    bump();
  };

  const pickSeq = (id: string) => {
    lab.seq = id;
    if (lab.running) startRun();
    else resetRun();
    synth.tick(660, 0.04);
    bump();
  };

  const stash = () => {
    lab.stash = { ...lab.params };
    lab.ghostOn = true;
    synth.tick(1180, 0.06);
    bump();
  };

  const curSeq = findSeq(lab.seq);
  const pred = predictRun(curSeq, lab.params);
  const ghostPred = lab.stash ? predictRun(curSeq, lab.stash) : null;
  const activePreset = PRESETS.find(
    (p) =>
      p.p.coef === lab.params.coef &&
      p.p.threshold === lab.params.threshold &&
      p.p.shield === lab.params.shield,
  );

  return (
    <div className="csl-panel panel">
      <div className="csl-head">
        <h2>Cargo shake</h2>
        <button className="csl-icon" onClick={() => setOpen(false)} aria-label="collapse panel">—</button>
      </div>

      <div className="csl-stats">
        <span>integrity <b>{Math.round(live.integrity * 100)}%</b></span>
        <span>payout <b>×{live.payout.toFixed(2)}</b></span>
        <span>{live.running ? 'running' : 'parked'} · <b>{live.fps}</b> fps</span>
      </div>

      <section>
        <h3>Bump sequence</h3>
        <div className="csl-row">
          {SEQUENCES.map((s) => (
            <button
              key={s.id}
              className={`csl-chip ${live.seq === s.id ? 'active' : ''}`}
              onClick={() => pickSeq(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="csl-note">{curSeq.note}</p>
      </section>

      <section>
        <h3>Damage chain</h3>
        <label className="csl-slider">
          <span className="csl-slider-label">FRAGILE_DMG</span>
          <input
            type="range" min={0.002} max={0.03} step={0.001} value={lab.params.coef}
            onChange={(e) => { lab.params.coef = parseFloat(e.target.value); bump(); }}
            aria-label="integrity lost per unit of impact"
          />
          <span className="csl-slider-val">{lab.params.coef.toFixed(3)}</span>
        </label>
        <label className="csl-slider">
          <span className="csl-slider-label">impact floor</span>
          <input
            type="range" min={4} max={16} step={0.5} value={lab.params.threshold}
            onChange={(e) => { lab.params.threshold = parseFloat(e.target.value); bump(); }}
            aria-label="impacts at or below this speed never register"
          />
          <span className="csl-slider-val">{lab.params.threshold.toFixed(1)} m/s</span>
        </label>
        <label className="csl-slider">
          <span className="csl-slider-label">shield level</span>
          <input
            type="range" min={0} max={3} step={1} value={lab.params.shield}
            onChange={(e) => { lab.params.shield = parseInt(e.target.value, 10); bump(); }}
            aria-label="cargo shield upgrade level, soaks six metres per second per level"
          />
          <span className="csl-slider-val">L{lab.params.shield} · soak {soakOf(lab.params)}</span>
        </label>
        <div className="csl-row">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`csl-chip ${activePreset?.id === p.id ? 'active' : ''} ${p.shipped ? 'shipped' : ''}`}
              onClick={() => pickPreset(p.id)}
              title={p.shipped ? 'what the game ships today' : 'candidate balance'}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="csl-note">
          {activePreset ? activePreset.note : 'Custom params — stash a preset as ghost A to compare before you wander off-recipe.'}
        </p>
      </section>

      <section>
        <h3>Damage per impact</h3>
        <ScatterChart tick={tick} />
      </section>

      <section>
        <h3>Payout curve</h3>
        <PayoutChart tick={tick} />
        <p className="csl-note">
          {curSeq.label} ends at <b>{pred.shattered ? 'SHATTERED — the job fails outright' : `${Math.round(pred.integrity * 100)}% integrity → ×${pred.payout.toFixed(2)} pay`}</b>
          {ghostPred && (
            <> · ghost A {ghostPred.shattered ? 'shatters' : `ends ${Math.round(ghostPred.integrity * 100)}% → ×${ghostPred.payout.toFixed(2)}`}</>
          )}
        </p>
      </section>

      <section>
        <h3>A/B ghost</h3>
        <div className="csl-row">
          <button className="csl-btn" onClick={stash}>◈ stash params as ghost A</button>
          <label className="csl-check">
            <input
              type="checkbox" checked={live.ghostOn && live.hasStash} disabled={!live.hasStash}
              onChange={(e) => { lab.ghostOn = e.target.checked; bump(); }}
            />
            ghost replay <em>G — slate bike, bone gauge</em>
          </label>
        </div>
        {lab.stash && (
          <p className="csl-note">
            A: coef <code>{lab.stash.coef.toFixed(3)}</code> · floor <code>{lab.stash.threshold}m/s</code> · shield <code>L{lab.stash.shield}</code>
            {' '}vs B: coef <code>{lab.params.coef.toFixed(3)}</code> · floor <code>{lab.params.threshold}m/s</code> · shield <code>L{lab.params.shield}</code>
          </p>
        )}
      </section>

      <section>
        <h3>Session</h3>
        <div className="csl-row">
          <button
            className={`csl-btn ${live.running ? 'primary' : ''}`}
            onClick={() => {
              if (lab.running) stopRun();
              else startRun();
              bump();
            }}
          >
            {live.running ? '■ stop (R)' : '▶ run sequence (R)'}
          </button>
          <label className="csl-check">
            <input
              type="checkbox" checked={live.loop}
              onChange={(e) => { lab.loop = e.target.checked; bump(); }}
            />
            loop <em>auto-replay</em>
          </label>
          <label className="csl-check">
            <input
              type="checkbox" checked={lab.reducedMotion}
              onChange={(e) => { lab.reducedMotion = e.target.checked; bump(); }}
            />
            reduced motion <em>accessibility</em>
          </label>
        </div>
        <div className="csl-row">
          <label className="csl-check">
            <input
              type="checkbox" checked={live.muted}
              onChange={(e) => { lab.muted = e.target.checked; synth.setMuted(e.target.checked); bump(); }}
            />
            mute <em>M</em>
          </label>
          <button
            className="csl-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(JSON.stringify(exportPayload(), null, 2));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? '✓ copied' : '⧉ copy preset JSON'}
          </button>
        </div>
      </section>

      <p className="csl-note dim-note">
        Shipped = <code>Bike.tsx</code> onCollisionEnter (impulse &gt; {SHIP.THRESHOLD} − shield·{SHIP.SOAK_PER_LEVEL}) →{' '}
        <code>MissionDirector.tsx</code> FRAGILE_DMG {SHIP.FRAGILE_DMG}, payout {SHIP.PAYOUT_BASE} + {SHIP.PAYOUT_SPAN}·integrity.
        The pan is deterministic: same params, same run, every time.
      </p>
    </div>
  );
}
