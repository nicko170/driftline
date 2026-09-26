/**
 * Booth — the case file under the grading lamp. For the selected sitter:
 * the four QC checks with their readings, the luminance histogram against
 * the warm-key window, faction-chip palette drift, silhouette scoring, the
 * true 64px dialogue-card crop with grayscale + Vienot CVD passes, the
 * faction-wall context hang, side-by-side grading, and the shot-list desk.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { Character } from '../../../dialogue/library';
import {
  factionOf,
  overall,
  regionName,
  shotList,
  wallNeighbours,
  type Check,
  type WallEntry,
} from './data';
import {
  CVD_LABELS,
  KEY_BAND,
  hexToHsl,
  hslCss,
  hueDistance,
  renderCvd,
  type CvdType,
  type PixelAnalysis,
} from './pixels';

/* ---------------- tiny instruments --------------------------------------- */

/** Horizontal gauge with fill, an optional "keeper zone" band and a caption. */
function Bar(props: {
  value: number; // 0–1
  zone?: [number, number];
  caption: string;
  warn?: boolean;
}) {
  return (
    <div className="ps-bar-row">
      <div className="ps-bar" role="img" aria-label={props.caption}>
        {props.zone && (
          <span
            className="ps-bar-zone"
            style={{ left: `${props.zone[0] * 100}%`, width: `${(props.zone[1] - props.zone[0]) * 100}%` }}
          />
        )}
        <span className={`ps-bar-fill ${props.warn ? 'warn' : ''}`} style={{ width: `${Math.min(100, props.value * 100)}%` }} />
      </div>
      <span className="ps-bar-cap">{props.caption}</span>
    </div>
  );
}

/** 16-bin luminance histogram with the warm-key window marked. */
function Histogram({ a }: { a: PixelAnalysis }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const tickH = 12, plotH = H - tickH;
    ctx.clearRect(0, 0, W, H);
    // warm-key window guide
    const x0 = KEY_BAND.lumaMin * W, x1 = KEY_BAND.lumaMax * W;
    ctx.fillStyle = 'rgba(87,196,184,0.10)';
    ctx.fillRect(x0, 0, x1 - x0, plotH);
    ctx.strokeStyle = 'rgba(87,196,184,0.45)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x0 + 0.5, 0.5, x1 - x0 - 1, plotH - 1);
    ctx.setLineDash([]);
    // bars
    const max = Math.max(...a.bins, 0.001);
    const bw = W / 16;
    for (let b = 0; b < 16; b++) {
      const h = (a.bins[b] / max) * (plotH - 6);
      const l = (b + 0.5) / 16;
      const g = ctx.createLinearGradient(0, plotH - h, 0, plotH);
      g.addColorStop(0, '#FF9E64');
      g.addColorStop(1, `rgb(${Math.round(255 - l * 60)}, ${Math.round(158 - l * 60)}, ${Math.round(100 - l * 30)})`);
      ctx.fillStyle = g;
      ctx.fillRect(b * bw + 1.5, plotH - h, bw - 3, h);
    }
    // mean + median rules
    const rule = (x: number, color: string, dash: number[]) => {
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 2);
      ctx.lineTo(x + 0.5, plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    rule(a.lumaMean * W, '#E4D7BE', []);
    rule(a.lumaMedian * W, '#FFB454', [4, 3]);
    ctx.fillStyle = 'rgba(228,215,190,0.55)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('mean', Math.min(W - 30, a.lumaMean * W + 4), plotH + 10);
    ctx.fillText('med', Math.min(W - 26, a.lumaMedian * W + 4), plotH + 10 - 0);
    ctx.fillText('0', 0, H - 2);
    ctx.fillText('luma 1', W - 34, H - 2);
  }, [a]);
  return <canvas ref={ref} width={272} height={84} className="ps-hist" aria-label="Luminance histogram" />;
}

/** One labelled chip for a QC check. */
function CheckChip({ c }: { c: Check }) {
  return (
    <li className={`ps-check ${c.grade}`} title={c.fix ?? c.reading}>
      <span className="ps-check-glyph" aria-hidden="true">
        {c.grade === 'pass' ? '✓' : c.grade === 'warn' ? '!' : '✕'}
      </span>
      <span className="ps-check-label">{c.label}</span>
      <span className="ps-check-reading">{c.reading}</span>
    </li>
  );
}

/* ---------------- 64px card + CVD strip ------------------------------------ */

function CvdTile({ src, type }: { src: HTMLCanvasElement; type: CvdType | 'orig' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const dst = ref.current;
    const ctx = dst?.getContext('2d');
    if (!dst || !ctx) return;
    ctx.clearRect(0, 0, dst.width, dst.height);
    if (type === 'orig') ctx.drawImage(src, 0, 0, dst.width, dst.height);
    else renderCvd(src, dst, type);
  }, [src, type]);
  return (
    <figure className="ps-cvd-tile">
      <canvas ref={ref} width={64} height={64} aria-label={type === 'orig' ? 'Original crop' : CVD_LABELS[type]} />
      <figcaption>{type === 'orig' ? 'Shipped' : type === 'gray' ? 'Values' : type}</figcaption>
    </figure>
  );
}

/* ---------------- context hang ------------------------------------------- */

function ContextHang({
  entry,
  analysis,
  analyses,
  entriesById,
}: {
  entry: WallEntry;
  analysis: PixelAnalysis | null;
  analyses: Map<string, PixelAnalysis | null>;
  entriesById: Map<string, WallEntry>;
}) {
  const c = entry.character;
  const neighbours = useMemo(() => wallNeighbours(c, 3), [c]);
  return (
    <div className="ps-context">
      <div className="ps-context-strip">
        {[entry, ...neighbours.map((n) => entriesById.get(n.id)).filter((e): e is WallEntry => Boolean(e))].map(
          (e) => (
            <figure key={e.character.id} className={`ps-context-frame ${e.character.id === c.id ? 'is-focus' : ''}`}>
              <span className="ps-pin" style={{ color: e.faction.color }} aria-hidden="true">{e.faction.glyph}</span>
              {e.declaredArt ? (
                <img src={withBase(e.declaredArt)} alt="" loading="lazy" draggable={false} />
              ) : (
                <span className="ps-initials" aria-hidden="true">{e.character.name.slice(0, 2).toUpperCase()}</span>
              )}
              <figcaption>{e.character.name.split(' ')[0]}</figcaption>
            </figure>
          ),
        )}
      </div>
      <ul className="ps-context-notes">
        {neighbours.map((n) => {
          const na = analyses.get(n.id);
          if (!analysis || !na)
            return (
              <li key={n.id} className="dim">
                {n.name.split(' ')[0]}: film {analyses.has(n.id) ? 'unreadable' : 'still developing'} — no read.
              </li>
            );
          const dHue = analysis.domHue !== null && na.domHue !== null ? hueDistance(analysis.domHue, na.domHue) : null;
          const dLuma = Math.abs(analysis.lumaMean - na.lumaMean);
          const alike =
            dHue !== null ? dHue < 16 && dLuma < 0.06 : dLuma < 0.05 && Math.abs(analysis.meanSat - na.meanSat) < 0.08;
          return (
            <li key={n.id} className={alike ? 'alike' : ''}>
              {alike ? '◈ reads alike from the door' : '✓ hangs distinct'} — {n.name}
              {dHue !== null && ` · hue gap ${dHue.toFixed(0)}°`} · value gap {dLuma.toFixed(2)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- side-by-side grading ------------------------------------ */

interface RowSpec {
  label: string;
  fmt: (a: PixelAnalysis, c: Character) => string;
  val: (a: PixelAnalysis, c: Character) => number | null;
  better: 'high' | 'low';
}

const ROWS: RowSpec[] = [
  { label: 'Warm-key share', fmt: (a) => `${Math.round(a.warmShare * 100)}%`, val: (a) => a.warmShare, better: 'high' },
  {
    label: 'Faction drift',
    fmt: (a, c) => {
      const f = factionOf(c);
      if (f.chipHue === null) return `bone · sat ${Math.round(a.meanSat * 100)}%`;
      return a.domHue === null ? 'no chroma' : `${hueDistance(a.domHue, f.chipHue).toFixed(0)}° off chip`;
    },
    val: (a, c) => {
      const f = factionOf(c);
      if (f.chipHue === null || a.domHue === null) return null;
      return hueDistance(a.domHue, f.chipHue);
    },
    better: 'low',
  },
  { label: 'Silhouette', fmt: (a) => `${a.silhouette}/100`, val: (a) => a.silhouette, better: 'high' },
  { label: 'Face σ @64px', fmt: (a) => a.crop64.centreStd.toFixed(3), val: (a) => a.crop64.centreStd, better: 'high' },
  { label: 'Edges @64px', fmt: (a) => `${(a.crop64.edgeDensity * 100).toFixed(1)}%`, val: (a) => a.crop64.edgeDensity, better: 'high' },
];

function Compare({
  aEntry,
  aAnalysis,
  analyses,
  entriesById,
}: {
  aEntry: WallEntry;
  aAnalysis: PixelAnalysis | null;
  analyses: Map<string, PixelAnalysis | null>;
  entriesById: Map<string, WallEntry>;
}) {
  const candidates = [...entriesById.values()].filter(
    (e) => e.character.id !== aEntry.character.id && e.declaredArt && analyses.get(e.character.id),
  );
  const [bId, setBId] = useState<string>('');
  const bEntry = entriesById.get(bId) ?? candidates[0];
  const bAnalysis = bEntry ? analyses.get(bEntry.character.id) : null;

  useEffect(() => {
    if (bEntry && !candidates.some((e) => e.character.id === bEntry.character.id)) setBId('');
  }, [bEntry, candidates]);

  if (!aAnalysis) return <p className="dim">Grade A needs its film developed first.</p>;
  if (!bEntry || !bAnalysis) return <p className="dim">No developed rival on the wall yet — let more film dry.</p>;

  const A = aEntry.character, B = bEntry.character;
  let aWins = 0, bWins = 0;
  const rows = ROWS.map((r) => {
    const va = r.val(aAnalysis, A);
    const vb = r.val(bAnalysis, B);
    let edge: 'A' | 'B' | '·' = '·';
    if (va !== null && vb !== null && Math.abs(va - vb) > 1e-6) {
      edge = (r.better === 'high' ? va > vb : va < vb) ? 'A' : 'B';
    }
    if (edge === 'A') aWins++;
    if (edge === 'B') bWins++;
    return { r, va, vb, edge };
  });

  return (
    <div className="ps-compare">
      <div className="ps-compare-heads">
        <span className="ps-vs-chip a">A — {A.name}</span>
        <label>
          <span className="ps-toollabel">vs</span>
          <select value={bEntry.character.id} onChange={(e) => setBId(e.target.value)} aria-label="Choose portrait B">
            {candidates.map((e) => (
              <option key={e.character.id} value={e.character.id}>
                B — {e.character.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="ps-compare-table">
        <thead>
          <tr><th>Check</th><th>A</th><th>B</th><th aria-label="Edge">⚖</th></tr>
        </thead>
        <tbody>
          {rows.map(({ r, edge }) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className={edge === 'A' ? 'win' : ''}>{r.fmt(aAnalysis, A)}</td>
              <td className={edge === 'B' ? 'win' : ''}>{r.fmt(bAnalysis, B)}</td>
              <td className={`ps-edge ${edge === 'A' ? 'a' : edge === 'B' ? 'b' : ''}`}>
                {edge === 'A' ? '◀ A' : edge === 'B' ? 'B ▶' : '·'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ps-compare-verdict">
        {aWins === bWins
          ? 'Deuce — keep whichever makes the writers laugh.'
          : `${aWins > bWins ? A.name : B.name} takes the wall, ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}.`}
      </p>
    </div>
  );
}

/* ---------------- shot list ---------------------------------------------- */

function ShotList({ c, checks }: { c: Character; checks: Check[] | null }) {
  const text = useMemo(() => shotList(c, checks), [c, checks]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="ps-shot">
      <pre>{text}</pre>
      <button className="btn primary" onClick={copy}>
        {copied ? '✓ Copied to the clipboard' : 'Copy shot list'}
      </button>
    </div>
  );
}

/* ---------------- the booth ---------------------------------------------- */

export interface BoothProps {
  entry: WallEntry;
  analysis: PixelAnalysis | null;
  checks: Check[] | null;
  developing: boolean;
  analyses: Map<string, PixelAnalysis | null>;
  entriesById: Map<string, WallEntry>;
}

export function Booth({ entry, analysis, checks, developing, analyses, entriesById }: BoothProps) {
  const c = entry.character;
  const f = entry.faction;
  const grade = checks ? overall(checks) : null;
  const chipHsl = hexToHsl(f.color);
  const measuredHue = analysis?.domHue ?? null;

  return (
    <aside className="ps-booth panel" aria-label={`Case file for ${c.name}`}>
      {/* case file head */}
      <header className="ps-case">
        <div className="ps-case-portrait">
          {entry.declaredArt ? (
            <img src={withBase(entry.declaredArt)} alt={(c as { heroAlt?: string }).heroAlt ?? `Portrait of ${c.name}`} />
          ) : (
            <span className="ps-initials big" aria-hidden="true">{c.name.slice(0, 2).toUpperCase()}</span>
          )}
          {grade && (
            <span className={`ps-case-grade g-${grade.letter.toLowerCase()}`}>
              <i aria-hidden="true">{grade.glyph}</i> {grade.label}
              <em>{grade.score}/8</em>
            </span>
          )}
        </div>
        <div className="ps-case-id">
          <h3>{c.name}</h3>
          <p className="ps-case-role">{c.role}</p>
          <p className="ps-case-chips">
            <span className="ps-chip" style={{ borderColor: f.color }}>
              <i style={{ color: f.color }} aria-hidden="true">{f.glyph}</i> {f.name}
            </span>
            <span className="ps-chip dim">⌂ {regionName(c.home)}</span>
          </p>
          {analysis && (
            <p className="dim ps-case-dims">
              film {analysis.naturalW}×{analysis.naturalH} · id <code>{c.id}.jpg</code>
            </p>
          )}
          {!entry.declaredArt && <p className="dim ps-case-dims">◌ awaiting a sitting — no film in the drawer.</p>}
          {entry.declaredArt && developing && <p className="dim ps-case-dims">◌ film developing…</p>}
          {entry.declaredArt && !developing && !analysis && (
            <p className="ps-case-dims ps-missing">✕ declared art not found on the wall — check the filename.</p>
          )}
        </div>
      </header>

      {/* check chips */}
      {checks && (
        <ul className="ps-checks" aria-label="QC checks">
          {checks.map((ch) => (
            <CheckChip key={ch.id} c={ch} />
          ))}
        </ul>
      )}

      {analysis && (
        <>
          <details open className="ps-section">
            <summary>Light &amp; key</summary>
            <Histogram a={analysis} />
            <Bar value={analysis.warmShare} zone={[0.38, 1]} warn={analysis.warmShare < 0.22}
              caption={`${Math.round(analysis.warmShare * 100)}% in the warm-key window (keeper ≥ 38%)`} />
            <Bar value={analysis.lumaMean} zone={[KEY_BAND.lumaMin, KEY_BAND.lumaMax]}
              caption={`mean luminance ${analysis.lumaMean.toFixed(2)} (window ${KEY_BAND.lumaMin}–${KEY_BAND.lumaMax})`} />
          </details>

          <details open className="ps-section">
            <summary>Palette vs the {f.glyph} chip</summary>
            <div className="ps-swatches">
              <figure>
                <span className="ps-swatch" style={{ background: f.color }} />
                <figcaption>chip<br />{f.color} · {f.chipHue !== null ? `${f.chipHue.toFixed(0)}°` : 'neutral'}</figcaption>
              </figure>
              <span className="ps-swatches-vs" aria-hidden="true">⇄</span>
              <figure>
                <span
                  className="ps-swatch"
                  style={{
                    background:
                      measuredHue !== null && analysis
                        ? hslCss(measuredHue, Math.min(1, analysis.meanSat * 1.6), 0.55)
                        : hslCss(chipHsl[0], 0, 0.5),
                  }}
                />
                <figcaption>canvas<br />{measuredHue !== null ? `${measuredHue.toFixed(0)}° · sat ${Math.round(analysis.meanSat * 100)}%` : 'no chroma'}</figcaption>
              </figure>
            </div>
            <Bar value={analysis.meanSat} zone={[0.1, 0.65]} warn={analysis.meanSat < 0.1 || analysis.meanSat > 0.72}
              caption={`mean saturation ${Math.round(analysis.meanSat * 100)}% (painted band 10–65%)`} />
            <Bar value={analysis.chromaMass} zone={[0.25, 1]}
              caption={`${Math.round(analysis.chromaMass * 100)}% of the frame carries votable chroma`} />
          </details>

          <details className="ps-section">
            <summary>Silhouette readability</summary>
            <Bar value={analysis.edgeDensity / 0.25} zone={[0.035 / 0.25, 0.16 / 0.25]}
              warn={analysis.edgeDensity < 0.035 || analysis.edgeDensity > 0.16}
              caption={`edge density ${(analysis.edgeDensity * 100).toFixed(1)}% (sweet zone 3.5–16%)`} />
            <Bar value={analysis.separation / 0.4} zone={[0.12 / 0.4, 1]} warn={analysis.separation < 0.12}
              caption={`figure/backdrop separation ${analysis.separation.toFixed(2)}`} />
            <p className="ps-gauge-big">
              <strong>{analysis.silhouette}</strong><span>/100 silhouette score — readable from across a dust storm, or not.</span>
            </p>
          </details>

          <details open className="ps-section">
            <summary>At dialogue size — the shipped 64px card</summary>
            <div className="ps-crop-row">
              <figure className="ps-crop-real">
                {/* exactly .dialogue-portrait img: 64px, cover, 10px radius */}
                <canvas
                  ref={(el) => {
                    const ctx = el?.getContext('2d');
                    if (el && ctx) {
                      ctx.clearRect(0, 0, 64, 64);
                      ctx.drawImage(analysis.crop64.canvas, 0, 0);
                    }
                  }}
                  width={64}
                  height={64}
                  aria-label={`${c.name} as the 64 pixel dialogue portrait`}
                />
                <figcaption>as shipped · 64px</figcaption>
              </figure>
              <figure className="ps-crop-zoom">
                <canvas
                  ref={(el) => {
                    const ctx = el?.getContext('2d');
                    if (el && ctx) {
                      ctx.imageSmoothingEnabled = false;
                      ctx.clearRect(0, 0, 192, 192);
                      ctx.drawImage(analysis.crop64.canvas, 0, 0, 192, 192);
                    }
                  }}
                  width={192}
                  height={192}
                  aria-label="Three-times nearest-neighbour inspection zoom"
                />
                <figcaption>bench zoom ×3</figcaption>
              </figure>
            </div>
            <div className="ps-cvd-strip">
              <CvdTile src={analysis.crop64.canvas} type="orig" />
              <CvdTile src={analysis.crop64.canvas} type="gray" />
              <CvdTile src={analysis.crop64.canvas} type="deutan" />
              <CvdTile src={analysis.crop64.canvas} type="protan" />
              <CvdTile src={analysis.crop64.canvas} type="tritan" />
            </div>
            <p className="dim ps-cvd-note">
              Vienot · Brettel · Mollon (1999) in linear light. If the face only reads in hue, it fails
              here before it fails a player.
            </p>
          </details>

          <details className="ps-section">
            <summary>Hang {c.name.split(' ')[0]} next to the {f.name} wall</summary>
            <ContextHang entry={entry} analysis={analysis} analyses={analyses} entriesById={entriesById} />
          </details>

          <details className="ps-section">
            <summary>Grade two sittings side-by-side</summary>
            <Compare aEntry={entry} aAnalysis={analysis} analyses={analyses} entriesById={entriesById} />
          </details>
        </>
      )}

      <details open className="ps-section">
        <summary>Shot-list desk</summary>
        <ShotList c={c} checks={checks} />
      </details>
    </aside>
  );
}
