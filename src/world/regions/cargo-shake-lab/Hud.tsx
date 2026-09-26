/**
 * Cargo Shake Lab — HUD. A large cargo-integrity gauge (game HUD language,
 * bench scale), the payout multiplier, the course progress strip with every
 * scripted event marked by shape+colour, a live hit feed, and the run result
 * card. Polls module sim state at ~10 Hz like the game HUD — nothing here
 * re-renders per frame.
 */
import { useEffect, useState } from 'react';
import {
  lab, run, feed, findSeq, payoutOf, ghostIntegrityNow, EVENTS, RUN_M,
} from './sim';

const KIND_MARK: Record<string, { glyph: string; cls: string }> = {
  rock: { glyph: '▲', cls: 'k-rock' },
  graze: { glyph: '●', cls: 'k-graze' },
  clip: { glyph: '■', cls: 'k-clip' },
  land: { glyph: '◆', cls: 'k-land' },
  gust: { glyph: '✕', cls: 'k-gust' },
  hop: { glyph: '⤴', cls: 'k-hop' },
};

interface Snap {
  integrity: number;
  payout: number;
  running: boolean;
  dist: number;
  seqId: string;
  events: { id: string; dist: number; kind: string; fired: boolean; label: string }[];
  feed: { t: number; label: string; impulse: number; loss: number; raw: number }[];
  ghostOn: boolean;
  ghostIntegrity: number;
  ghostStash: boolean;
  final: { seq: string; integrity: number; payout: number; shattered: boolean } | null;
  threshold: number;
  soak: number;
  nowT: number;
}

function readSnap(): Snap {
  const seq = findSeq(lab.seq);
  return {
    integrity: run.integrity,
    payout: payoutOf(run.integrity),
    running: lab.running,
    dist: run.dist,
    seqId: seq.id,
    events: seq.events.map((id) => {
      const ev = EVENTS.find((e) => e.id === id);
      return {
        id,
        dist: ev?.dist ?? 0,
        kind: ev?.kind ?? 'rock',
        fired: run.fired.has(id),
        label: ev?.label ?? id,
      };
    }),
    feed: feed.filter((f) => run.t - f.t < 4.5).slice(-4),
    ghostOn: lab.ghostOn && !!lab.stash,
    ghostIntegrity: ghostIntegrityNow(),
    ghostStash: !!lab.stash,
    final: run.lastFinal,
    threshold: lab.params.threshold,
    soak: lab.params.shield * 6,
    nowT: run.t,
  };
}

export function LabHud() {
  const [s, setS] = useState<Snap>(readSnap);
  useEffect(() => {
    const iv = window.setInterval(() => setS(readSnap()), 100);
    return () => window.clearInterval(iv);
  }, []);

  const pct = Math.round(s.integrity * 100);
  const gaugeCls = s.integrity <= 0 ? 'dead' : s.integrity < 0.35 ? 'low' : s.integrity < 0.6 ? 'mid' : '';

  return (
    <>
      {/* ------------------------------------------------ big gauge */}
      <div className={`csl-gauge ${gaugeCls}`} role="status" aria-label={`Cargo integrity ${pct} percent`}>
        <div className="csl-gauge-label">◻ fragile cargo — integrity</div>
        <div className="csl-gauge-main">
          <span className="csl-gauge-value">{pct}</span>
          <span className="csl-gauge-unit">%</span>
        </div>
        <div className="csl-gauge-bar">
          <div className="csl-gauge-fill" style={{ width: `${s.integrity * 100}%` }} />
        </div>
        <div className="csl-gauge-sub">
          <span>payout <b>×{s.payout.toFixed(2)}</b></span>
          <span className="csl-gauge-chain">
            floor {s.threshold} · soak {s.soak}
          </span>
        </div>
        {s.ghostOn && (
          <div className="csl-gauge-ghost" aria-label={`Ghost A integrity ${Math.round(s.ghostIntegrity * 100)} percent`}>
            <span>ghost A <b>{Math.round(s.ghostIntegrity * 100)}%</b></span>
            <div className="csl-gauge-ghostbar">
              <div style={{ width: `${s.ghostIntegrity * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------ course strip */}
      <div className="csl-course" role="img" aria-label={`Course progress ${Math.round((s.dist / RUN_M) * 100)} percent`}>
        <div className="csl-course-track">
          <div className="csl-course-fill" style={{ width: `${Math.min(100, (s.dist / RUN_M) * 100)}%` }} />
          {s.events.map((e) => {
            const m = KIND_MARK[e.kind] ?? KIND_MARK.rock;
            return (
              <span
                key={e.id}
                className={`csl-course-mark ${m.cls} ${e.fired ? 'fired' : ''}`}
                style={{ left: `${(e.dist / RUN_M) * 100}%` }}
                title={`${e.label} @ ${e.dist}m`}
              >
                {m.glyph}
              </span>
            );
          })}
          <span className="csl-course-end">◈</span>
        </div>
        <div className="csl-course-caption">
          {s.running ? `RUNNING — ${findSeq(s.seqId).label.toLowerCase()} · ${Math.round(s.dist)} m` : 'PARKED — press R to run the sequence'}
        </div>
      </div>

      {/* ------------------------------------------------ hit feed */}
      <div className="csl-feed" aria-live="polite">
        {s.feed.map((f) => (
          <div
            key={`${f.t}-${f.label}`}
            className={`csl-feed-row ${f.loss > 0 ? 'hit' : f.impulse > s.threshold && f.raw <= 0 ? 'soaked' : 'graze'}`}
            style={{ opacity: Math.max(0.25, 1 - (s.nowT - f.t) / 4.5) }}
          >
            <span className="csl-feed-label">{f.label}</span>
            <span className="csl-feed-nums">
              {f.impulse.toFixed(1)} m/s
              {f.loss > 0
                ? <b className="loss"> −{(f.loss * 100).toFixed(1)}%</b>
                : f.impulse > s.threshold && f.raw <= 0
                  ? <b className="soak"> soaked</b>
                  : f.raw > 0
                    ? <b className="scuff"> scuff</b>
                    : <b className="kiss"> under floor</b>}
            </span>
          </div>
        ))}
      </div>

      {/* -------------------------------------------- result card */}
      {!s.running && s.final && (
        <div className={`csl-result ${s.final.shattered ? 'shattered' : ''}`} role="status">
          <div className="csl-result-kicker">{s.final.shattered ? '◆ CARGO SHATTERED' : '◆ RUN COMPLETE'}</div>
          <div className="csl-result-title">
            {s.final.shattered
              ? 'The Guild will hear about this one.'
              : `${Math.round(s.final.integrity * 100)}% intact · ×${s.final.payout.toFixed(2)} pay`}
          </div>
          <div className="csl-result-sub">
            {s.final.shattered
              ? 'Integrity hit zero mid-run — in the game this fails the fragile job before payout.'
              : 'A paying delivery. Stash these params as ghost A, move a slider, run both.'}
          </div>
        </div>
      )}
    </>
  );
}
