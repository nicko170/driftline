/**
 * Coverage — the matrix wall. Rows are the surfaces a reputation could touch;
 * columns the four factions. Every cell carries its state as glyph + colour +
 * word (never colour alone), read live from the libraries where possible.
 * Below, the flags the survey raised, and the copy-ready claim sheet.
 */
import { useMemo, useState } from 'react';
import {
  CELL_STYLE,
  FACTIONS,
  buildExport,
  buildFlags,
  buildMatrix,
  type RepState,
} from './data';

export function CoverageMatrix({ rep }: { rep: RepState }) {
  const matrix = useMemo(buildMatrix, []);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = buildExport(rep);
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
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="rra-matrix-toolbar">
        <div className="rra-cell-legend" aria-label="Cell legend">
          {(Object.keys(CELL_STYLE) as (keyof typeof CELL_STYLE)[]).map((k) => (
            <span key={k} style={{ ['--sc' as string]: CELL_STYLE[k].color }}>
              <i aria-hidden="true">{CELL_STYLE[k].glyph}</i> {CELL_STYLE[k].word}
            </span>
          ))}
        </div>
        <button className="rra-copy" onClick={copy} aria-live="polite">
          {copied ? '✓ sheet copied' : '⎘ copy the claim sheet'}
        </button>
      </div>

      <div className="rra-matrix-wrap">
        <table className="rra-matrix">
          <thead>
            <tr>
              <th scope="col">Surface</th>
              {FACTIONS.map((f) => (
                <th key={f.id} scope="col" style={{ ['--fc' as string]: f.color }}>
                  <i aria-hidden="true">{f.glyph}</i> {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span className="rra-m-title">
                    <i aria-hidden="true">{row.glyph}</i> {row.title}
                  </span>
                  <span className="rra-m-blurb">{row.blurb}</span>
                </th>
                {FACTIONS.map((f) => {
                  const cell = row.cells[f.id];
                  if (!cell) return <td key={f.id} />;
                  const st = CELL_STYLE[cell.state];
                  return (
                    <td key={f.id} className={`rra-cell rra-cell-${cell.state}`} style={{ ['--sc' as string]: st.color }}>
                      <span className="rra-cell-mark">
                        <i aria-hidden="true">{st.glyph}</i> {cell.state === 'na' ? 'n/a' : st.word.split(' ')[0]}
                      </span>
                      <span className="rra-cell-text">{cell.text}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FlagsList() {
  const flags = useMemo(buildFlags, []);
  return (
    <ul className="rra-flags">
      {flags.map((f) => (
        <li key={f.id} className={`rra-flag rra-flag-${f.severity}`}>
          <span className="rra-flag-glyph" aria-hidden="true">
            {f.glyph}
          </span>
          <div>
            <h4>
              {f.title} <b className="rra-flag-sev">{f.severity === 'warn' ? '⚠ warn' : 'note'}</b>
            </h4>
            <p>{f.detail}</p>
            {f.factions.length > 0 && (
              <p className="rra-flag-marks">
                {f.factions.map((fid) => {
                  const fac = FACTIONS.find((x) => x.id === fid);
                  return (
                    <span key={fid} style={{ ['--fc' as string]: fac?.color ?? '#8A8578' }}>
                      {fac?.glyph} {fac?.name}
                    </span>
                  );
                })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
