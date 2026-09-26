/**
 * STAGE — the shipped title screen rebuilt as a tunable instrument.
 *
 * Same classes, same copy, same content order as src/ui/TitleScreen.tsx — but
 * every entrance beat is driven by the lab tokens (delay/duration/rise/ease
 * per beat via CSS custom properties), the key art sits under three hand-cut
 * parallax layers, and a font-swap class simulates the brand faces landing
 * late on a slow network. Parallax runs on one rAF loop with module-free
 * refs: no allocations per frame, and it parks entirely under reduced motion
 * or when the pointer leaves.
 */
import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { withBase } from '../../../lib/base';
import type { Epilogue } from '../../../missions/endings';
import { EASES, MENU_LABELS, type Beat, type TitleTokens } from './tokens';

interface StageProps {
  tokens: TitleTokens;
  schedule: Beat[];
  epilogue: Epilogue | null;
  reduce: boolean;
  runKey: number;
  fontsIn: boolean;
}

/* Layer multipliers — how far each stratum travels at full --px/--py swing.
 * Far art drifts least; dust motes drift most (and counter-swing). */
const LAYERS = { back: 0.18, mid: 0.5, front: 1, motes: 1.6 };

export function Stage({ tokens, schedule, epilogue, reduce, runKey, fontsIn }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const pxApplied = useRef({ x: 0, y: 0 });

  /* One rAF loop for pointer parallax. Writes CSS vars only when the applied
   * value moved by ≥0.05px, and collapses to centre under reduced motion. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const dead = reduce || tokens.parallaxPx === 0;
      const tx = dead ? 0 : target.current.x;
      const ty = dead ? 0 : target.current.y;
      const cx = current.current.x;
      const cy = current.current.y;
      const nx = cx + (tx - cx) * 0.09;
      const ny = cy + (ty - cy) * 0.09;
      current.current.x = nx;
      current.current.y = ny;
      if (
        Math.abs(nx - pxApplied.current.x) > 0.05 ||
        Math.abs(ny - pxApplied.current.y) > 0.05
      ) {
        pxApplied.current.x = nx;
        pxApplied.current.y = ny;
        el.style.setProperty('--px', `${nx.toFixed(2)}px`);
        el.style.setProperty('--py', `${ny.toFixed(2)}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, tokens.parallaxPx]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    target.current.x = nx * tokens.parallaxPx;
    target.current.y = ny * tokens.parallaxPx * 0.55;
  };
  const onPointerLeave = () => {
    target.current.x = 0;
    target.current.y = 0;
  };

  const beatStyle = (b: Beat) =>
    ({
      '--d': `${b.start}ms`,
      '--dur': `${b.end - b.start}ms`,
      '--rise': `${reduce ? 0 : tokens.risePx}px`,
    }) as CSSProperties;

  const beatOf = (id: string) => schedule.find((b) => b.id === id);

  const kicker = beatOf('kicker');
  const logo = beatOf('logo');
  const tag = beatOf('tag');
  const epi = beatOf('epilogue');
  const hint = beatOf('hint');
  const foot = beatOf('foot');

  return (
    <div
      ref={stageRef}
      className={`tml-stage ${fontsIn ? '' : 'fonts-out'} ${reduce ? 'reduce' : ''}`}
      style={{ '--ease': EASES[tokens.ease].css } as CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label="Live reconstruction of the Driftline title screen: layered key art with pointer parallax, and the menu entrance playing out beat by beat"
    >
      {/* ---- parallax strata ---- */}
      <div
        className="tml-layer tml-back"
        style={
          {
            backgroundImage: `url(${withBase('images/title/keyart.jpg')})`,
            '--m': LAYERS.back,
          } as CSSProperties
        }
      />
      <div className="tml-layer tml-mid" style={{ '--m': LAYERS.mid } as CSSProperties}>
        <svg viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 214 L120 196 L186 158 H338 L384 196 L520 182 L562 128 H764 L806 180 L986 170 L1024 146 H1184 L1226 188 L1440 172 V300 H0 Z"
            fill="#2A2140"
            opacity="0.82"
          />
        </svg>
      </div>
      <div className="tml-layer tml-front" style={{ '--m': LAYERS.front } as CSSProperties}>
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 158 C 240 118 420 172 720 148 C 1020 128 1240 174 1440 146 V220 H0 Z"
            fill="#1B1526"
            opacity="0.94"
          />
          {/* old skyship ribs surfacing from the dune */}
          <g stroke="#7E3320" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.9">
            <path d="M296 170 q4 -52 26 -60" />
            <path d="M322 174 q6 -62 32 -66" />
            <path d="M350 176 q8 -66 36 -68" />
          </g>
          {/* comms mast remnant, far side */}
          <g stroke="#2E8C8C" strokeWidth="5" fill="none" opacity="0.85">
            <path d="M1236 152 L1248 92 M1248 92 L1262 110" />
          </g>
        </svg>
        <i className="tml-beacon" aria-hidden="true" />
      </div>
      <div className="tml-layer tml-motes" style={{ '--m': LAYERS.motes } as CSSProperties}>
        <i className="tml-mote" style={{ left: '16%', top: '30%', animationDuration: '11s' }} />
        <i className="tml-mote teal" style={{ left: '72%', top: '22%', animationDuration: '14s' }} />
        <i className="tml-mote" style={{ left: '44%', top: '58%', animationDuration: '9s' }} />
        <i className="tml-mote teal" style={{ left: '86%', top: '64%', animationDuration: '16s' }} />
        <i className="tml-mote" style={{ left: '58%', top: '12%', animationDuration: '12s' }} />
      </div>
      <div className="title-scrim tml-scrim" />

      {/* ---- the entrance (remount on key to replay) ---- */}
      <main key={runKey} className={`title-main tml-entrance run ${reduce ? 'reduce' : ''}`}>
        {kicker && (
          <p className="title-kicker tml-beat" style={beatStyle(kicker)}>
            KESSA-9 · THE GLASS DESERT
          </p>
        )}
        {logo && (
          <h1 className="title-logo tml-beat" style={beatStyle(logo)}>
            DRIFTLINE
          </h1>
        )}
        {tag && (
          <p className="title-tag tml-beat" style={beatStyle(tag)}>
            Any crate. Any storm. Any door. — You're Ash Varga: a new courier with a second-hand
            hover-bike, a debt, and a package that shouldn't exist.
          </p>
        )}
        {epilogue && epi && (
          <aside className="title-epilogue panel tml-beat tml-beat-epi" style={beatStyle(epi)}>
            <span className="title-epilogue-kicker">{epilogue.kicker}</span>
            <strong className="title-epilogue-title">{epilogue.title}</strong>
            <p>{epilogue.text}</p>
            <p className="dim">{epilogue.coda}</p>
          </aside>
        )}
        <nav className="title-menu" aria-label="Main menu (bench replica)">
          {MENU_LABELS.map((label, n) => {
            const b = beatOf(`menu-${n}`);
            if (!b) return null;
            return (
              <button
                key={b.id}
                type="button"
                className={`btn tml-beat ${n === 0 ? 'primary big' : ''}`}
                style={beatStyle(b)}
                tabIndex={-1}
              >
                {label}
              </button>
            );
          })}
        </nav>
        {hint && (
          <p className="title-hint tml-beat" style={beatStyle(hint)}>
            <kbd>W A S D</kbd> ride · <kbd>Shift</kbd> boost · <kbd>Space</kbd> hop ·{' '}
            <kbd>E</kbd> interact · gamepad &amp; touch supported
          </p>
        )}
        {foot && (
          <p className="tml-colophon title-hint tml-beat" style={beatStyle(foot)}>
            DRIFTLINE was designed and built autonomously by Kimi K3 running on GreenThread.
          </p>
        )}
      </main>

      {/* ---- font-swap status chip ---- */}
      <div className={`tml-facechip ${fontsIn ? 'on' : ''}`} aria-live="polite">
        {fontsIn ? (
          <>
            <b>✓</b> Chakra Petch + Sora on set
          </>
        ) : (
          <>
            <b>◌</b> system fallback holding…
          </>
        )}
      </div>
    </div>
  );
}
