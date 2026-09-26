/**
 * CvdStrip — the colour-blind-safe proof. A marker legend is drawn once per
 * palette, then re-rendered through deutan / protan / tritan matrices. Because
 * every marker family also differs by shape, the legend stays readable in all
 * three simulations even where colours collapse toward one another.
 */
import { useEffect, useRef, useState } from 'react';
import { PALETTES, type MinimapPalette } from './palettes';
import { simulateCvd, CVD_LABELS, type CvdType } from './cvd';

const W = 300;
const H = 92;
const TYPES: CvdType[] = ['deutan', 'protan', 'tritan'];

/** Draw the legend: panel chip with all marker families + a storm wedge swatch. */
function paintLegend(ctx: CanvasRenderingContext2D, pal: MinimapPalette): void {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  // storm wedge swatch
  ctx.beginPath();
  ctx.arc(26, H / 2, 21, 0, Math.PI * 2);
  ctx.fillStyle = pal.stormFill;
  ctx.fill();
  ctx.strokeStyle = pal.stormEdge;
  ctx.stroke();

  const cy = H / 2;
  const put = (
    x: number, color: string,
    draw: (c: CanvasRenderingContext2D) => void, label: string,
  ) => {
    ctx.save();
    ctx.translate(x, cy - 8);
    ctx.fillStyle = color;
    draw(ctx);
    ctx.restore();
    ctx.fillStyle = 'rgba(228, 215, 190, 0.85)';
    ctx.font = '600 8.5px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, cy + 22);
  };

  put(72, pal.waypoint, (c) => {
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(9, 0); c.lineTo(0, 9); c.lineTo(-9, 0);
    c.closePath(); c.fill();
  }, 'waypoint');
  put(136, pal.convoy, (c) => { c.fillRect(-7, -7, 14, 14); }, 'convoy');
  put(196, pal.chase, (c) => {
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(8, 7); c.lineTo(-8, 7);
    c.closePath(); c.fill();
  }, 'chase');
  put(256, pal.player, (c) => {
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8);
    c.closePath(); c.fill();
  }, 'you');
}

export function CvdStrip() {
  const [palId, setPalId] = useState('day');
  const pal = PALETTES.find((p) => p.id === palId) ?? PALETTES[0];
  const srcRef = useRef<HTMLCanvasElement>(null);
  const simRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const src = srcRef.current;
    if (!src) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    src.width = W * dpr;
    src.height = H * dpr;
    const sctx = src.getContext('2d');
    if (!sctx) return;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLegend(sctx, pal);
    TYPES.forEach((t, i) => {
      const dst = simRefs.current[i];
      if (!dst) return;
      dst.width = W * dpr;
      dst.height = H * dpr;
      // simulation runs on raw device pixels for an honest per-pixel transform
      simulateCvd(src, dst, t);
    });
  }, [pal]);

  return (
    <section className="cml-panel" aria-label="Colour blindness proof">
      <h3>
        Colour-blind-safe, proven <span className="cml-sub">shape carries meaning, colour reinforces</span>
      </h3>
      <div className="cml-palpicker" role="group" aria-label="Palette under test">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            className={`cml-palbtn ${p.id === palId ? 'active' : ''}`}
            onClick={() => setPalId(p.id)}
            style={{ borderColor: p.waypoint }}
          >
            {p.id}
          </button>
        ))}
      </div>
      <div className="cml-cvdrow">
        <figure>
          <canvas ref={srcRef} style={{ width: W, height: H }} aria-label="Marker legend, full colour" />
          <figcaption>full colour</figcaption>
        </figure>
        {TYPES.map((t, i) => (
          <figure key={t}>
            <canvas
              ref={(el) => { simRefs.current[i] = el; }}
              style={{ width: W, height: H }}
              aria-label={`Marker legend simulated, ${t}`}
            />
            <figcaption>{CVD_LABELS[t]}</figcaption>
          </figure>
        ))}
      </div>
      <p className="cml-note">
        Even where amber/teal/rust collapse into one another under simulation, the
        diamond / square / triangle / arrow silhouettes stay separable — that is the
        accessibility rule the HUD obeys everywhere: <b>shape + colour, never colour alone.</b>
      </p>
    </section>
  );
}

export default CvdStrip;
