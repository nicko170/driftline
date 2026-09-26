/**
 * SurveyMap — the printed survey sheet. One SVG, real metres as user units:
 * paper ground, faint 200 m graticule, marching-squares terrain contours in
 * ochre, region discs in faction colours, teal nearest-neighbour threads
 * between anchors, brown survey-station crosses, and every signal cache as an
 * open violet diamond sitting inside its TRUE 13 m capture disc. Crowded
 * anchors get count badges; crowded fans show the spiral path through their
 * slots and dashed ghost rings where the next slots would land. Diamonds stay
 * screen-sized across zooms (capture discs stay true) so the world view stays
 * clickable.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPTURE_RADIUS,
  CROWD_AMBER,
  contourSurvey,
  fanSlot,
  regionStyle,
  type ContourSet,
  type PlottedCache,
  type RegionSurvey,
  type SurveyModel,
} from './data';

const VIOLET = '#9A86D0';
const VIOLET_DEEP = '#6A56A8';
const PAPER = '#F3EEE2';
const INK_BROWN = '#5C4632';
const OCHRE = '#B07C3A';
const TEAL = '#2E8C8C';
const RUST = '#B3502E';
const AMBER_HOT = '#FFC969';
const DANGER = '#E4572E';

type VBox = { x: number; y: number; w: number; h: number };

/** Smoothly lerps the viewBox; jumps instantly under prefers-reduced-motion. */
function useAnimatedBox(target: VBox): VBox {
  const [box, setBox] = useState<VBox>(target);
  const boxRef = useRef(box);
  boxRef.current = box;
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setBox(target);
      return;
    }
    const from = boxRef.current;
    if (from.w === target.w && from.x === target.x && from.y === target.y && from.h === target.h) return;
    const t0 = performance.now();
    const DUR = 460;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setBox({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.w, target.h]);
  return box;
}

/** Nearest-neighbour threads between anchors of one region (survey web). */
function regionThreads(region: RegionSurvey): { x1: number; z1: number; x2: number; z2: number }[] {
  const pts = Object.values(region.anchors).map((a) => ({ x: a.pos[0], z: a.pos[1] }));
  const edges: { x1: number; z1: number; x2: number; z2: number }[] = [];
  const seen = new Set<string>();
  for (const p of pts) {
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (const q of pts) {
      if (q === p) continue;
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    if (best) {
      const id = [p, best].map((o) => `${o.x},${o.z}`).sort().join('|');
      if (!seen.has(id)) {
        seen.add(id);
        edges.push({ x1: p.x, z1: p.z, x2: best.x, z2: best.z });
      }
    }
  }
  return edges;
}

export interface SurveyMapProps {
  model: SurveyModel;
  focusRegion: string | null;
  selectedId: string | null;
  hoverId: string | null;
  showCaptures: boolean;
  showFans: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

export function SurveyMap({
  model,
  focusRegion,
  selectedId,
  hoverId,
  showCaptures,
  showFans,
  onSelect,
  onHover,
}: SurveyMapProps) {
  const { bounds } = model;
  const focused = focusRegion ? model.regions.find((r) => r.slug === focusRegion) ?? null : null;

  const target: VBox = useMemo(() => {
    const b = focused
      ? (() => {
          const r = focused.meta.radius + 120;
          return { minX: focused.meta.center[0] - r, minZ: focused.meta.center[1] - r, maxX: focused.meta.center[0] + r, maxZ: focused.meta.center[1] + r };
        })()
      : bounds;
    return { x: b.minX, y: b.minZ, w: b.maxX - b.minX, h: b.maxZ - b.minZ };
  }, [focused, bounds]);
  const box = useAnimatedBox(target);
  const unit = box.w / 100; // 1% of view width — screen-ish sizing for chrome
  const zoomed = !!focused;

  const contours: ContourSet[] = useMemo(() => contourSurvey(bounds), [bounds]);

  const threads = useMemo(
    () => model.regions.map((r) => ({ slug: r.slug, edges: regionThreads(r) })),
    [model.regions],
  );

  const overlapPairs = useMemo(() => {
    const set = new Set<string>();
    for (const o of model.overlaps) {
      set.add(o.a.id);
      set.add(o.b.id);
    }
    return set;
  }, [model.overlaps]);

  const cacheById = useMemo(() => new Map(model.caches.map((c) => [c.id, c])), [model.caches]);
  const selected = selectedId ? cacheById.get(selectedId) ?? null : null;

  // anchor ordering for drawing: quiet first, crowded last (badges on top)
  const anchors = useMemo(
    () => [...model.anchorStats.values()].sort((a, b) => a.count - b.count),
    [model.anchorStats],
  );

  const dim = (region: string, focusedSlug: string | null) => (focusedSlug && region !== focusedSlug ? 0.1 : 1);

  const diamondPath = (s: number) => `M0 ${-s}L${s * 0.72} 0L0 ${s}L${-s * 0.72} 0Z`;

  const renderCache = (c: PlottedCache) => {
    const d = dim(c.region, focusRegion);
    const isSel = selectedId === c.id;
    const isHov = hoverId === c.id;
    const size = unit * (isSel ? 1.6 : isHov ? 1.35 : 1.1);
    const stroke = c.simulated ? AMBER_HOT : overlapPairs.has(c.id) ? DANGER : VIOLET_DEEP;
    return (
      <g key={c.id} opacity={d} className="cdp-cache">
        {showCaptures && (!zoomed ? d >= 1 || isSel : true) ? (
          <circle
            cx={c.x}
            cy={c.z}
            r={CAPTURE_RADIUS}
            fill={c.simulated ? AMBER_HOT : overlapPairs.has(c.id) ? DANGER : VIOLET}
            fillOpacity={isSel ? 0.16 : 0.05}
            stroke={stroke}
            strokeOpacity={isSel ? 0.9 : 0.4}
            strokeWidth={isSel ? unit * 0.28 : unit * 0.16}
            strokeDasharray={c.simulated ? `${unit * 0.7} ${unit * 0.5}` : undefined}
          />
        ) : null}
        {isSel && (
          <>
            <circle cx={c.x} cy={c.z} r={size * 1.9} fill="none" stroke={stroke} strokeWidth={unit * 0.16} strokeOpacity={0.75} />
          </>
        )}
        <path
          d={diamondPath(size)}
          transform={`translate(${c.x} ${c.z})`}
          fill={c.simulated ? AMBER_HOT : VIOLET}
          fillOpacity={c.simulated ? 0.85 : isSel || isHov ? 0.55 : 0.22}
          stroke={stroke}
          strokeWidth={unit * 0.18}
          strokeLinejoin="round"
          className="cdp-cache-hit"
          role="button"
          tabIndex={0}
          aria-label={`${c.id} — recovers ${c.lore} at ${c.anchor}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(isSel ? null : c.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(isSel ? null : c.id);
            }
          }}
          onMouseEnter={() => onHover(c.id)}
          onMouseLeave={() => onHover(null)}
        >
          <title>{`${c.id} · slot k${c.k} on ${c.anchor} · ${c.lore}`}</title>
        </path>
      </g>
    );
  };

  const renderAnchorFan = (a: (typeof anchors)[number]) => {
    if (!showFans) return null;
    if (a.count < 2) return null;
    if (!zoomed && a.level === 'ok' && selected?.anchor !== a.key) return null;
    const own = model.caches.filter((c) => c.anchor === a.key).sort((c1, c2) => c1.k - c2.k);
    const pts = own.map((c) => `${c.x},${c.z}`).join(' ');
    const ghosts: { x: number; z: number; k: number }[] = [];
    if ((zoomed || selected?.anchor === a.key) && a.count < 16) {
      for (let k = a.count; k < Math.min(a.count + 3, 16); k++) {
        const s = fanSlot(k);
        ghosts.push({ x: a.x + s.dx, z: a.z + s.dz, k });
      }
    }
    const d = dim(a.region, focusRegion);
    return (
      <g key={`fan-${a.key}`} opacity={d}>
        <polyline
          points={`${a.x},${a.z} ${pts}`}
          fill="none"
          stroke={VIOLET_DEEP}
          strokeOpacity={0.45}
          strokeWidth={unit * 0.12}
          strokeDasharray={`${unit * 0.5} ${unit * 0.45}`}
        />
        {ghosts.map((g) => (
          <g key={g.k}>
            <circle cx={g.x} cy={g.z} r={unit * 0.85} fill="none" stroke={VIOLET} strokeOpacity={0.5} strokeWidth={unit * 0.12} strokeDasharray={`${unit * 0.28} ${unit * 0.26}`} />
            <text x={g.x} y={g.z - unit * 1.25} fontSize={unit * 1.1} textAnchor="middle" fill={VIOLET_DEEP} fillOpacity={0.75} className="cdp-lbl">
              k{g.k}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const overlapLinks = model.overlaps.slice(0, 40).map((o, i) => (
    <line
      key={i}
      x1={o.a.x}
      y1={o.a.z}
      x2={o.b.x}
      y2={o.b.z}
      stroke={DANGER}
      strokeOpacity={0.55}
      strokeWidth={unit * 0.16}
      strokeDasharray={`${unit * 0.5} ${unit * 0.35}`}
    />
  ));

  const graticule = useMemo(() => {
    const step = 200;
    const lines: string[] = [];
    const labels: { x: number; z: number; t: string }[] = [];
    for (let x = Math.ceil(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
      lines.push(`M${x} ${bounds.minZ}V${bounds.maxZ}`);
      labels.push({ x, z: bounds.minZ, t: `${x}` });
    }
    for (let z = Math.ceil(bounds.minZ / step) * step; z <= bounds.maxZ; z += step) {
      lines.push(`M${bounds.minX} ${z}H${bounds.maxX}`);
      labels.push({ x: bounds.minX, z, t: `${z}` });
    }
    return { d: lines.join(''), labels };
  }, [bounds]);

  return (
    <svg
      className="cdp-map"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      role="img"
      aria-label="Survey sheet of every signal cache in the Glass Desert"
      onClick={() => onSelect(null)}
    >
      {/* paper */}
      <rect x={box.x - box.w} y={box.y - box.h} width={box.w * 3} height={box.h * 3} fill={PAPER} />
      <rect
        x={bounds.minX}
        y={bounds.minZ}
        width={bounds.maxX - bounds.minX}
        height={bounds.maxZ - bounds.minZ}
        fill="none"
        stroke={INK_BROWN}
        strokeOpacity={0.35}
        strokeWidth={unit * 0.2}
      />
      <path d={graticule.d} stroke="#D9A45B" strokeOpacity={0.35} strokeWidth={unit * 0.05} fill="none" />

      {/* terrain contours */}
      {contours.map((c) => (
        <path
          key={c.level}
          d={c.d}
          fill="none"
          stroke={OCHRE}
          strokeOpacity={c.index ? 0.5 : 0.22}
          strokeWidth={c.index ? unit * 0.14 : unit * 0.07}
        />
      ))}

      {/* region discs + threads + labels */}
      {model.regions.map((r) => {
        const st = regionStyle(r.slug);
        const d = dim(r.slug, focusRegion);
        const [cx, cz] = r.meta.center;
        const th = threads.find((t) => t.slug === r.slug);
        return (
          <g key={r.slug} opacity={d}>
            <circle
              cx={cx}
              cy={cz}
              r={r.meta.radius}
              fill={st.color}
              fillOpacity={focused?.slug === r.slug ? 0.05 : 0.03}
              stroke={st.color}
              strokeOpacity={0.75}
              strokeWidth={unit * 0.2}
              strokeDasharray={`${unit * 1.1} ${unit * 0.8}`}
            />
            {th?.edges.map((e, i) => (
              <line key={i} x1={e.x1} y1={e.z1} x2={e.x2} y2={e.z2} stroke={TEAL} strokeOpacity={0.42} strokeWidth={unit * 0.13} />
            ))}
            <text
              x={cx}
              y={cz - r.meta.radius - unit * 1.4}
              fontSize={unit * 1.9}
              textAnchor="middle"
              fill={st.color}
              className="cdp-lbl cdp-lbl-region"
            >
              {st.glyph} {r.slug.replace(/-/g, ' ').toUpperCase()} · {r.cacheCount}⟡
            </text>
          </g>
        );
      })}

      {/* fan spirals + ghost slots */}
      {anchors.map(renderAnchorFan)}

      {/* cross-anchor overlap links */}
      {overlapLinks}

      {/* anchors — survey-station crosses */}
      {anchors.map((a) => {
        const d = dim(a.region, focusRegion);
        const st = regionStyle(a.region);
        const t = unit * 1.15;
        const cross = `M${a.x - t} ${a.z}H${a.x + t}M${a.x} ${a.z - t}V${a.z + t}`;
        const badged = a.count >= CROWD_AMBER;
        const showLabel = zoomed || badged || hoverId === a.key || selected?.anchor === a.key;
        return (
          <g key={`st-${a.key}`} opacity={d}>
            <path d={cross} stroke={badged ? (a.level === 'red' ? DANGER : AMBER_HOT) : INK_BROWN} strokeOpacity={0.9} strokeWidth={unit * 0.2} />
            {badged && (
              <g transform={`translate(${a.x} ${a.z - unit * 3.4})`}>
                <rect
                  x={-unit * 3.2}
                  y={-unit * 1.5}
                  width={unit * 6.4}
                  height={unit * 2.6}
                  rx={unit * 0.5}
                  fill={a.level === 'red' ? DANGER : AMBER_HOT}
                  fillOpacity={0.92}
                  stroke={a.level === 'red' ? '#7E3320' : '#8A5335'}
                  strokeWidth={unit * 0.12}
                />
                <text x={0} y={unit * 0.55} fontSize={unit * 1.5} textAnchor="middle" fill={a.level === 'red' ? PAPER : '#3A2413'} className="cdp-lbl cdp-badge-lbl">
                  {a.level === 'red' ? '■' : '▲'} ×{a.count}
                </text>
              </g>
            )}
            {showLabel && (
              <text x={a.x + unit * 1.8} y={a.z + unit * 1.1} fontSize={unit * 1.25} fill={st.color} className="cdp-lbl">
                {a.anchorId}
                {a.count > 0 ? ` ·${a.count}` : ''}
              </text>
            )}
          </g>
        );
      })}

      {/* connection from selected cache to its station */}
      {selected && (
        <line
          x1={selected.x}
          y1={selected.z}
          x2={(model.anchorStats.get(selected.anchor)?.x ?? selected.x)}
          y2={(model.anchorStats.get(selected.anchor)?.z ?? selected.z)}
          stroke={selected.simulated ? AMBER_HOT : VIOLET_DEEP}
          strokeOpacity={0.6}
          strokeWidth={unit * 0.14}
        />
      )}

      {/* caches */}
      {model.caches.map(renderCache)}

      {/* compass rose — true north is up (−z) */}
      <g transform={`translate(${box.x + box.w - unit * 6} ${box.y + unit * 7})`} opacity={0.8}>
        <circle r={unit * 2.6} fill="none" stroke={INK_BROWN} strokeOpacity={0.5} strokeWidth={unit * 0.12} />
        <path d={`M0 ${-unit * 2.6}L${unit * 0.7} 0L0 ${unit * 0.9}L${-unit * 0.7} 0Z`} fill={RUST} />
        <text y={-unit * 3.4} fontSize={unit * 1.5} textAnchor="middle" fill={INK_BROWN} className="cdp-lbl">N</text>
      </g>
    </svg>
  );
}
