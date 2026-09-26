/**
 * TRAFFIC PLANNER — the surveyor's table.
 *
 * Where the ambient fleet gets its legs: plot courier, hauler and skiff loops
 * over a relief chart of Kessa-9 (region circles + named anchors read
 * statically from the same meta.json/anchors.json files the registry streams),
 * replay them at real speed or 16× against the shipping manifest's ghost
 * traffic to spot congestion and dead zones, then export a ready-to-paste
 * VEHICLES manifest in the exact VehicleSpec format AmbientTraffic consumes.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [7300, 6900])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  CLASS_PRESETS,
  KIND_ORDER,
  MAP_REGIONS,
  SHIPPING_MANIFEST,
  blankRoute,
  exportManifest,
  findAnchor,
  fmtKm,
  fmtLap,
  polylineOf,
  randomRoute,
  routeLength,
  servedCounts,
  snapWaypoint,
  starterRoutes,
  withReturnLeg,
  SNAP_RADIUS_M,
  type PlannerRoute,
  type VehicleKind,
} from './data';
import { MapCanvas } from './MapCanvas';
import './traffic-planner.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

const STORE_KEY = 'driftline.lab.traffic-planner.v1';

function loadRoutes(): PlannerRoute[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every((r) => r && typeof r.id === 'string' && Array.isArray(r.waypoints))
      ) {
        return parsed as PlannerRoute[];
      }
    }
  } catch {
    /* fall through to starter legs */
  }
  return starterRoutes();
}

function TrafficPlanner() {
  const [routes, setRoutes] = useState<PlannerRoute[]>(loadRoutes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(4);
  const [showManifest, setShowManifest] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const routesRef = useRef(routes);
  routesRef.current = routes;
  const historyRef = useRef<PlannerRoute[][]>([]);
  const [histLen, setHistLen] = useState(0);

  const pushHistory = useCallback(() => {
    historyRef.current.push(routesRef.current);
    if (historyRef.current.length > 40) historyRef.current.shift();
    setHistLen(historyRef.current.length);
  }, []);

  const commit = useCallback(
    (fn: (prev: PlannerRoute[]) => PlannerRoute[]) => {
      pushHistory();
      setRoutes(fn);
    },
    [pushHistory],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(routes));
    } catch {
      /* storage full or private mode — the table is in-memory only */
    }
  }, [routes]);

  // keep the selection honest after undo / lift-route
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId && !routes.some((r) => r.id === selectedId)) {
      setSelectedId(null);
      setSelectedPoint(null);
    } else if (selected && selectedPoint !== null && selectedPoint >= selected.waypoints.length) {
      setSelectedPoint(selected.waypoints.length - 1);
    }
  }, [routes, selectedId, selectedPoint, selected]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    setHistLen(historyRef.current.length);
    if (prev) setRoutes(prev);
  }, []);

  /* ---- mutations from the canvas ---- */
  const addPoint = useCallback(
    (routeId: string, x: number, z: number) => {
      const wp = snapWaypoint(x, z, SNAP_RADIUS_M);
      commit((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, waypoints: [...r.waypoints, wp] } : r)),
      );
      setSelectedPoint((routesRef.current.find((r) => r.id === routeId)?.waypoints.length ?? 0));
    },
    [commit],
  );

  const movePoint = useCallback(
    (routeId: string, index: number, x: number, z: number) => {
      const wp = snapWaypoint(x, z, SNAP_RADIUS_M);
      setRoutes((prev) =>
        prev.map((r) =>
          r.id === routeId
            ? { ...r, waypoints: r.waypoints.map((w, i) => (i === index ? wp : w)) }
            : r,
        ),
      );
    },
    [],
  );

  const removePoint = useCallback(
    (routeId: string, index: number) => {
      commit((prev) =>
        prev.map((r) =>
          r.id === routeId
            ? { ...r, waypoints: r.waypoints.filter((_, i) => i !== index) }
            : r,
        ),
      );
      setSelectedPoint(null);
    },
    [commit],
  );

  const onSelect = useCallback((routeId: string | null, pointIndex: number | null) => {
    setSelectedId(routeId);
    setSelectedPoint(pointIndex);
  }, []);

  /* ---- toolbar actions ---- */
  const newRoute = useCallback(
    (kind: VehicleKind) => {
      const r = blankRoute(kind);
      commit((prev) => [...prev, r]);
      setSelectedId(r.id);
      setSelectedPoint(null);
      setDrawing(true);
    },
    [commit],
  );

  const stampRandom = useCallback(() => {
    const r = randomRoute();
    commit((prev) => [...prev, r]);
    setSelectedId(r.id);
    setDrawing(false);
  }, [commit]);

  const stampReturn = useCallback(() => {
    if (!selected) return;
    commit((prev) => prev.map((r) => (r.id === selected.id ? withReturnLeg(r) : r)));
  }, [commit, selected]);

  const liftRoute = useCallback(
    (id: string) => {
      commit((prev) => prev.filter((r) => r.id !== id));
    },
    [commit],
  );

  const clearTable = useCallback(() => {
    commit(() => []);
    setSelectedId(null);
    setSelectedPoint(null);
  }, [commit]);

  const patchSelected = useCallback(
    (patch: Partial<PlannerRoute>) => {
      if (!selected) return;
      setRoutes((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
    },
    [selected],
  );

  const commitKind = useCallback(
    (kind: VehicleKind) => {
      if (!selected) return;
      const p = CLASS_PRESETS[kind];
      commit((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, kind, speed: p.speedDef, hover: p.hover, glow: p.glow, color: p.hulls[0] }
            : r,
        ),
      );
    },
    [commit, selected],
  );

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedPoint !== null) {
        e.preventDefault();
        removePoint(selectedId, selectedPoint);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Escape') {
        if (exportOpen) setExportOpen(false);
        else onSelect(null, null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedPoint, removePoint, undo, exportOpen, onSelect]);

  /* ---- derived tallies ---- */
  const polylines = useMemo(
    () => [
      ...(showManifest ? SHIPPING_MANIFEST.map((v) => v.route) : []),
      ...routes.map(polylineOf),
    ],
    [routes, showManifest],
  );
  const served = useMemo(() => servedCounts(polylines), [polylines]);
  const deadCount = MAP_REGIONS.filter((r) => (served.get(r.slug) ?? 0) === 0).length;
  const chartedKm = routes
    .map(polylineOf)
    .filter((p) => p.length >= 2)
    .reduce((a, p) => a + routeLength(p), 0);
  const exportText = useMemo(() => exportManifest(routes), [routes]);

  const copyExport = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(exportText).then(done, done);
    } else {
      const ta = document.getElementById('tp-export-text') as HTMLTextAreaElement | null;
      if (ta) {
        ta.focus();
        ta.select();
        document.execCommand('copy');
      }
      done();
    }
  }, [exportText]);

  return (
    <div className="tp-root">
      <header
        className="tp-head"
        style={{ backgroundImage: `url(${withBase('images/work/traffic-planner.jpg')})` }}
        role="img"
        aria-label="A frontier surveyor's table with a relief map of the Glass Desert, brass dividers and rust-red hover-bike figurines marking route legs"
      >
        <div className="tp-head-veil">
          <h2>Traffic Planner</h2>
          <p>
            The surveyor's table for the Driftline fleet. Stamp legs on the chart, watch them
            run against the shipping traffic, then export the manifest the game actually reads.
          </p>
        </div>
        <div className="tp-tally" aria-label="Table tally">
          <span>
            <strong>{routes.length}</strong> plotted {routes.length === 1 ? 'leg' : 'legs'}
          </span>
          <span>
            <strong>{(chartedKm / 1000).toFixed(1)}</strong> km charted
          </span>
          <span>
            <strong>{SHIPPING_MANIFEST.length}</strong> ghost legs
          </span>
          {deadCount > 0 && (
            <span className="tp-tally-flag">
              <strong>{deadCount}</strong> dead {deadCount === 1 ? 'zone' : 'zones'}
            </span>
          )}
        </div>
      </header>

      <div className="tp-toolbar" role="toolbar" aria-label="Route tools">
        <span className="tp-tool-label">New leg</span>
        {KIND_ORDER.map((kind) => {
          const p = CLASS_PRESETS[kind];
          return (
            <button
              key={kind}
              className={`tp-class-btn tp-class-${kind}`}
              title={`${p.label}: ${p.blurb}`}
              onClick={() => newRoute(kind)}
            >
              <i aria-hidden="true" className="tp-sil" />
              {p.label}
            </button>
          );
        })}
        <span className="tp-rule" aria-hidden="true" />
        <button className="tp-btn" onClick={stampRandom} title="Generate a plausible leg between two distant anchors">
          ✧ Stamp a random leg
        </button>
        <button className="tp-btn" onClick={stampReturn} disabled={!selected || selected.waypoints.length < 3} title="Append the return leg (mirrored interior waypoints)">
          ⇄ Return leg
        </button>
        <button className="tp-btn" onClick={undo} disabled={histLen === 0} title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button className="tp-btn tp-btn-danger" onClick={clearTable} disabled={routes.length === 0}>
          ✕ Clear table
        </button>
        <span className="tp-rule" aria-hidden="true" />
        <button
          className={`tp-btn ${playing ? 'on' : ''}`}
          aria-pressed={playing}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? '❚❚ Running' : '▶ Replay'}
        </button>
        <div className="tp-seg" role="group" aria-label="Replay speed">
          {[1, 4, 16].map((m) => (
            <button
              key={m}
              className={simSpeed === m ? 'on' : ''}
              aria-pressed={simSpeed === m}
              onClick={() => setSimSpeed(m)}
            >
              ×{m}
            </button>
          ))}
        </div>
        <button
          className={`tp-btn ${showManifest ? 'on' : ''}`}
          aria-pressed={showManifest}
          onClick={() => setShowManifest((v) => !v)}
          title="Show the shipping fleet (AmbientTraffic's live manifest) as ghost traffic"
        >
          ◌ Ghost fleet
        </button>
        <span className="tp-rule" aria-hidden="true" />
        <button className="tp-btn tp-btn-primary" onClick={() => setExportOpen(true)}>
          ⇪ Export manifest
        </button>
      </div>

      <div className="tp-body">
        <div className="tp-chart">
          <MapCanvas
            routes={routes}
            selectedId={selectedId}
            selectedPoint={selectedPoint}
            drawing={drawing}
            playing={playing}
            simSpeed={simSpeed}
            showManifest={showManifest}
            onAddPoint={addPoint}
            onMovePoint={movePoint}
            onRemovePoint={removePoint}
            onSelect={onSelect}
          />
          <p className="tp-chart-hint">
            {selected
              ? drawing
                ? `Plotting “${CLASS_PRESETS[selected.kind].label} leg” — click the sheet to drop a pin (snaps to named anchors), drag to move, right-click to lift.`
                : 'Leg stowed — press a class stamp to plot a new one, or click this leg on the sheet to re-edit.'
              : 'Pick a class stamp above to start a leg — or click a plotted line to select it.'}
          </p>
        </div>

        <aside className="tp-rail">
          <section className="tp-panel" aria-label="Plotted legs">
            <h3><span aria-hidden="true">◈</span> Manifest table</h3>
            {routes.length === 0 ? (
              <p className="tp-empty">The table is clean. Stamp a class above, or roll a random leg.</p>
            ) : (
              <ul className="tp-route-list">
                {routes.map((r, i) => {
                  const pts = polylineOf(r);
                  const km = pts.length >= 2 ? routeLength(pts) : 0;
                  const p = CLASS_PRESETS[r.kind];
                  const touches = r.waypoints
                    .map((w) => w.anchor)
                    .filter((a): a is string => Boolean(a));
                  const summary =
                    touches.length >= 2
                      ? `${touches[0].split(':')[0]} ⇄ ${touches[touches.length - 1].split(':')[0]}`
                      : touches.length === 1
                        ? touches[0]
                        : 'freehand';
                  return (
                    <li key={r.id}>
                      <button
                        className={`tp-route ${r.id === selectedId ? 'selected' : ''}`}
                        style={{ ['--rc' as string]: r.glow }}
                        onClick={() => {
                          setSelectedId(r.id);
                          setSelectedPoint(null);
                        }}
                        aria-current={r.id === selectedId}
                      >
                        <span className="tp-route-glyph" aria-hidden="true">{p.glyph}</span>
                        <span className="tp-route-name">
                          Leg {i + 1} · {p.label}
                          <small>{summary}</small>
                        </span>
                        <span className="tp-route-km">{pts.length >= 2 ? fmtKm(km) : `${pts.length} pin${pts.length === 1 ? '' : 's'}`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {selected && (
            <section className="tp-panel tp-inspector" aria-label="Selected leg inspector">
              <h3><span aria-hidden="true">{CLASS_PRESETS[selected.kind].glyph}</span> Leg inspector</h3>
              <div className="tp-insp-kind" role="group" aria-label="Vehicle class">
                {KIND_ORDER.map((kind) => (
                  <button
                    key={kind}
                    className={selected.kind === kind ? 'on' : ''}
                    aria-pressed={selected.kind === kind}
                    onClick={() => commitKind(kind)}
                  >
                    {CLASS_PRESETS[kind].glyph} {CLASS_PRESETS[kind].label}
                  </button>
                ))}
              </div>
              <label className="tp-field">
                <span>Cruise speed <b>{selected.speed} m/s · {Math.round(selected.speed * 3.6)} km/h</b></span>
                <input
                  type="range"
                  min={CLASS_PRESETS[selected.kind].speedMin}
                  max={CLASS_PRESETS[selected.kind].speedMax}
                  step={1}
                  value={selected.speed}
                  onBlur={pushHistory}
                  onChange={(e) => patchSelected({ speed: Number(e.target.value) })}
                />
              </label>
              <label className="tp-field">
                <span>Start offset <b>{Math.round(selected.phase * 100)}%</b></span>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.01}
                  value={selected.phase}
                  onBlur={pushHistory}
                  onChange={(e) => patchSelected({ phase: Number(e.target.value) })}
                />
              </label>
              <div className="tp-field">
                <span>Hull</span>
                <div className="tp-swatches" role="group" aria-label="Hull colour">
                  {CLASS_PRESETS[selected.kind].hulls.map((c) => (
                    <button
                      key={c}
                      className={`tp-swatch ${selected.color === c ? 'on' : ''}`}
                      style={{ background: c }}
                      aria-label={`Hull ${c}`}
                      aria-pressed={selected.color === c}
                      onClick={() => {
                        pushHistory();
                        patchSelected({ color: c });
                      }}
                    />
                  ))}
                </div>
              </div>
              <dl className="tp-readouts">
                <div>
                  <dt>Loop length</dt>
                  <dd>{selected.waypoints.length >= 2 ? fmtKm(routeLength(polylineOf(selected))) : '—'}</dd>
                </div>
                <div>
                  <dt>Lap time</dt>
                  <dd>{selected.waypoints.length >= 2 ? fmtLap(routeLength(polylineOf(selected)) / selected.speed) : '—'}</dd>
                </div>
                <div>
                  <dt>Pins</dt>
                  <dd>{selected.waypoints.length}</dd>
                </div>
              </dl>
              {selected.waypoints.some((w) => w.anchor) && (
                <p className="tp-touches">
                  <em>Touches</em>{' '}
                  {selected.waypoints
                    .map((w) => w.anchor)
                    .filter((a): a is string => Boolean(a))
                    .filter((a, i, arr) => arr.indexOf(a) === i)
                    .map((a) => (
                      <span key={a} className="tp-touch" title={findAnchor(a)?.label ?? a}>{a}</span>
                    ))}
                </p>
              )}
              {selected.waypoints.length > 0 && (
                <ul className="tp-pins" aria-label="Waypoints">
                  {selected.waypoints.map((w, i) => (
                    <li key={i} className={i === selectedPoint ? 'sel' : ''}>
                      <button
                        className="tp-pin-pick"
                        onClick={() => setSelectedPoint(i)}
                        title="Select pin (Delete lifts it)"
                      >
                        <span className="tp-pin-n">#{i + 1}</span>
                        <span className="tp-pin-x">
                          {w.anchor ?? `${Math.round(w.x)}, ${Math.round(w.z)}`}
                        </span>
                      </button>
                      <button
                        className="tp-pin-del"
                        aria-label={`Lift pin ${i + 1}`}
                        onClick={() => removePoint(selected.id, i)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="tp-insp-actions">
                <button className="tp-btn" onClick={stampReturn} disabled={selected.waypoints.length < 3}>
                  ⇄ Return leg
                </button>
                <button className="tp-btn tp-btn-danger" onClick={() => liftRoute(selected.id)}>
                  ✕ Lift off table
                </button>
              </div>
            </section>
          )}

          <section className="tp-panel" aria-label="Coverage tally">
            <h3><span aria-hidden="true">◎</span> Coverage</h3>
            <ul className="tp-coverage">
              {MAP_REGIONS.map((r) => {
                const n = served.get(r.slug) ?? 0;
                return (
                  <li key={r.slug} className={n === 0 ? 'dead' : ''}>
                    <span className="tp-cov-glyph" aria-hidden="true">{n === 0 ? '⚠' : '◈'}</span>
                    <span className="tp-cov-name">{r.name}</span>
                    <span className="tp-cov-n">{n === 0 ? 'dead zone' : `served ×${n}`}</span>
                  </li>
                );
              })}
            </ul>
            <p className="tp-cov-note">A region counts as served when a line passes inside its circle{showManifest ? ' — ghost fleet included' : ' — ghost fleet hidden, so this tallies your table only'}.</p>
          </section>

          <section className="tp-panel tp-legend" aria-label="Legend">
            <h3><span aria-hidden="true">▤</span> Legend</h3>
            <ul>
              <li><i className="tp-lg tp-lg-pin" /> pin — drag to move, ⇧ right-click lifts</li>
              <li><i className="tp-lg tp-lg-snap" /> teal pip — pin snapped to a named anchor</li>
              <li><i className="tp-lg tp-lg-courier" /> courier ◆ · <i className="tp-lg tp-lg-hauler" /> hauler ▣ · <i className="tp-lg tp-lg-skiff" /> skiff ▲</li>
              <li><i className="tp-lg tp-lg-miss" /> amber ring — two hulls within {55} m (mind the dust)</li>
              <li><i className="tp-lg tp-lg-ghost" /> dashed — the shipping fleet from AmbientTraffic</li>
            </ul>
          </section>
        </aside>
      </div>

      <label className="tp-draw-toggle">
        <input
          type="checkbox"
          checked={drawing}
          onChange={(e) => setDrawing(e.target.checked)}
        />
        Plotting mode — clicking the sheet appends pins to the selected leg (off: clicking selects)
      </label>

      {exportOpen && (
        <div className="tp-export" role="dialog" aria-modal="true" aria-label="Export manifest">
          <div className="tp-export-panel">
            <h3><span aria-hidden="true">⇪</span> VehicleSpec manifest</h3>
            <p>
              Paste over <code>const VEHICLES</code> in <code>src/game/AmbientTraffic.tsx</code>.
              Field names, hover heights and glow colours follow the shipping contract; the
              trailing comments carry the anchor references.
            </p>
            <textarea
              id="tp-export-text"
              readOnly
              rows={18}
              value={exportText}
              onFocus={(e) => e.target.select()}
            />
            <div className="tp-export-actions">
              <button className="tp-btn tp-btn-primary" onClick={copyExport}>
                {copied ? '✓ On the clipboard' : '⧉ Copy'}
              </button>
              <button className="tp-btn" onClick={() => setExportOpen(false)}>
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="tp-foot">
        <p>
          The chart reads the region registry&rsquo;s own <code>meta.json</code>/<code>anchors.json</code>
          files, so new regions and anchors appear here as they land. The ghost fleet is mirrored
          verbatim from <code>src/game/AmbientTraffic.tsx</code> — keep <code>SHIPPING_MANIFEST</code>{' '}
          in <code>data.ts</code> in step when the shipped fleet changes. The replay honours the
          game&rsquo;s real semantics: metres-per-second along the polyline, teleport-wrap home,
          no height math.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = TrafficPlanner as typeof TrafficPlanner & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
