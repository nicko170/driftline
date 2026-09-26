/**
 * ChecksPanel — renders the invariant suite and the "copy constants" exporter.
 */
import { useMemo, useState } from 'react';
import { runChecks } from './checks';
import { PALETTES, contrast, grade } from './palettes';
import { COMPASS_WINDOW, MARKER_CLAMP_X, MARKER_CLAMP_Y } from './navmath';

const STATUS_GLYPH = { pass: '✓', warn: '!', fail: '✗' } as const;

export function ChecksPanel() {
  const results = useMemo(runChecks, []);
  const [copied, setCopied] = useState(false);
  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;

  const copy = async () => {
    const json = JSON.stringify(exportPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="cml-panel" aria-label="Invariant checks">
      <div className="cml-checks-head">
        <h3>
          Invariants{' '}
          <span className={`cml-chip ${fails ? 'cml-chip-fail' : 'cml-chip-aaa'}`}>
            {results.length - fails - warns} pass · {warns} warn · {fails} fail
          </span>
        </h3>
        <button className="cml-copy" onClick={copy}>{copied ? 'copied ✓' : 'copy constants JSON'}</button>
      </div>
      <ul className="cml-checks">
        {results.map((r) => (
          <li key={r.id} className={`cml-check cml-check-${r.status}`}>
            <span className="cml-check-glyph" aria-hidden>{STATUS_GLYPH[r.status]}</span>
            <div>
              <div className="cml-check-label">{r.label}</div>
              <div className="cml-check-detail">{r.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ChecksPanel;

/** Constants tuned/validated here, ready to paste into the game. */
function exportPayload() {
  return {
    compass: {
      window: COMPASS_WINDOW,
      halfSpanPct: 48,
      note: 'mirrors src/ui/HUD.tsx — ticks hidden at |off| >= window',
    },
    marker: {
      clampX: MARKER_CLAMP_X,
      clampY: MARKER_CLAMP_Y,
      hoist: 3.5,
      note: 'mirrors src/game/CameraRig.tsx marker projection',
    },
    minimapPalettes: PALETTES.map((p) => ({
      ...p,
      measuredContrast: {
        waypoint: +contrast(p.waypoint, p.bg).toFixed(2),
        convoy: +contrast(p.convoy, p.bg).toFixed(2),
        chase: +contrast(p.chase, p.bg).toFixed(2),
        player: +contrast(p.player, p.bg).toFixed(2),
      },
      grades: {
        waypoint: grade(contrast(p.waypoint, p.bg)),
        convoy: grade(contrast(p.convoy, p.bg)),
        chase: grade(contrast(p.chase, p.bg)),
        player: grade(contrast(p.player, p.bg)),
      },
    })),
  };
}
