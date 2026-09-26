/**
 * MinimapLab — the same fake scene drawn at all four candidate time-of-day
 * palettes, with measured WCAG contrast per marker colour under each one.
 */
import { useEffect, useRef } from 'react';
import { PALETTES, contrast, grade, type MinimapPalette } from './palettes';
import { drawLabMinimap, type LabWorld } from './world';

const TILE = 148;

function PaletteTile({ pal, world }: { pal: MinimapPalette; world: LabWorld }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = TILE * dpr;
    canvas.height = TILE * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawLabMinimap(ctx, TILE, world, pal);
  }, [pal, world]);

  return <canvas ref={ref} className="cml-mmtile" style={{ width: TILE, height: TILE }} aria-label={`Minimap at ${pal.label} palette`} />;
}

export function MinimapLab({ world }: { world: LabWorld }) {
  return (
    <section className="cml-panel" aria-label="Minimap palettes and contrast">
      <h3>Minimap × 4 skies <span className="cml-sub">same scene, measured contrast</span></h3>
      <div className="cml-mmgrid">
        {PALETTES.map((p) => (
          <div key={p.id} className="cml-mmcell">
            <PaletteTile pal={p} world={world} />
            <span className="cml-mmlabel">{p.label}</span>
          </div>
        ))}
      </div>
      <table className="cml-table">
        <thead>
          <tr>
            <th>palette</th><th>◆ waypoint</th><th>▪ convoy</th><th>▲ chase</th><th>➤ you</th>
          </tr>
        </thead>
        <tbody>
          {PALETTES.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              {[p.waypoint, p.convoy, p.chase, p.player].map((col, i) => {
                const r = contrast(col, p.bg);
                const g = grade(r);
                return (
                  <td key={i}>
                    <span className={`cml-chip cml-chip-${g}`}>{r.toFixed(1)}:1</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cml-note">
        Chips are measured live (WCAG 2.x relative luminance against the panel bg):
        <span className="cml-chip cml-chip-aaa">≥7 AAA</span>
        <span className="cml-chip cml-chip-aa">≥4.5 AA</span>
        <span className="cml-chip cml-chip-ui">≥3 UI</span>
        <span className="cml-chip cml-chip-fail">&lt;3 fail</span>
      </p>
    </section>
  );
}

export default MinimapLab;
