/**
 * checks — the lab's automated invariant suite. Sweeps the mirrored HUD math
 * and reports pass / warn / fail with measured detail. "warn" is reserved for
 * convention audits (things the game code may intend; flagged for the builder,
 * never silently asserted away).
 */
import {
  COMPASS_WINDOW, COMPASS_POINTS, MARKER_CLAMP_X, MARKER_CLAMP_Y,
  angDiff, compassLeftPct, bearingTo, projectMarker, MARKER_SHAPES,
} from './navmath';
import { PALETTES, contrast, grade } from './palettes';

export interface CheckResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export function runChecks(): CheckResult[] {
  const out: CheckResult[] = [];
  const pass = (id: string, label: string, detail: string) =>
    out.push({ id, label, status: 'pass', detail });
  const fail = (id: string, label: string, detail: string) =>
    out.push({ id, label, status: 'fail', detail });

  // 1 — window edge: strict inequality (game uses Math.abs(off) < 0.9)
  {
    const edge = compassLeftPct(COMPASS_WINDOW, 0);
    const inside = compassLeftPct(COMPASS_WINDOW - 0.001, 0);
    edge === null && inside !== null
      ? pass('window-edge', 'Compass window edge is strict',
        `|off| = ${COMPASS_WINDOW} rad → hidden; ${(COMPASS_WINDOW - 0.001).toFixed(3)} rad → left ${inside!.toFixed(1)}%`)
      : fail('window-edge', 'Compass window edge is strict',
        `edge=${edge} inside=${inside} (game uses Math.abs(off) < ${COMPASS_WINDOW})`);
  }

  // 2 — visible ticks always land inside the pill (left ∈ [2%, 98%])
  {
    let worst = 0;
    let ok = true;
    for (let i = 0; i <= 720; i++) {
      const h = (i / 720) * Math.PI * 2 - Math.PI;
      for (const [ang] of COMPASS_POINTS) {
        const pct = compassLeftPct(ang, h);
        if (pct === null) continue;
        worst = Math.max(worst, Math.abs(pct - 50));
        if (pct < 2 || pct > 98) ok = false;
      }
    }
    ok
      ? pass('tick-bounds', 'Visible ticks stay inside the pill',
        `max |left − 50| = ${worst.toFixed(1)}% across a 2π heading sweep (pill half-span ${48}%)`)
      : fail('tick-bounds', 'Visible ticks stay inside the pill', `worst offset ${worst.toFixed(1)}%`);
  }

  // 3 — waypoint diamond uses the same window math as ticks
  {
    let ok = true;
    let maxDelta = 0;
    for (let i = 0; i <= 360; i++) {
      const b = (i / 360) * Math.PI * 2 - Math.PI;
      const h = 0.7;
      const viaTick = compassLeftPct(b, h);
      const off = angDiff(b, h);
      const viaDiamond = Math.abs(off) < COMPASS_WINDOW ? 50 + (off / COMPASS_WINDOW) * 48 : null;
      if (viaTick !== viaDiamond) ok = false;
      if (viaTick !== null && viaDiamond !== null) maxDelta = Math.max(maxDelta, Math.abs(viaTick - viaDiamond));
    }
    ok
      ? pass('diamond-parity', 'Waypoint diamond shares tick math',
        `diamond ≡ tick formula, Δ = ${maxDelta} over 361 bearings at heading 0.7`)
      : fail('diamond-parity', 'Waypoint diamond shares tick math', 'formulas diverged — HUD drift');
  }

  // 4 — marker clamp holds under adversarial targets (fuzz)
  {
    let ok = true;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let rawMax = 0;
    let seed = 1234567;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 4000; i++) {
      const px = (rnd() - 0.5) * 2400;
      const pz = (rnd() - 0.5) * 2400;
      const h = rnd() * Math.PI * 2;
      const tx = px + (rnd() - 0.5) * 6000;
      const tz = pz + (rnd() - 0.5) * 6000;
      const m = projectMarker(px, pz, h, tx, tz, rnd() * 40, 0.4 + rnd() * 2.6, rnd() > 0.5);
      rawMax = Math.max(rawMax, Math.abs(m.rawX - 0.5), Math.abs(m.rawY - 0.5));
      if (Number.isNaN(m.x) || Number.isNaN(m.y)) { ok = false; break; }
      minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x);
      minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
      if (m.x < MARKER_CLAMP_X[0] - 1e-9 || m.x > MARKER_CLAMP_X[1] + 1e-9) ok = false;
      if (m.y < MARKER_CLAMP_Y[0] - 1e-9 || m.y > MARKER_CLAMP_Y[1] + 1e-9) ok = false;
    }
    ok
      ? pass('marker-clamp', 'Marker clamp holds under fuzz (4000×)',
        `x ∈ [${minX.toFixed(3)}, ${maxX.toFixed(3)}], y ∈ [${minY.toFixed(3)}, ${maxY.toFixed(3)}]; ` +
        `raw projections reached ±${rawMax.toFixed(1)} (viewport half = 0.5) without NaN or escape`)
      : fail('marker-clamp', 'Marker clamp holds under fuzz (4000×)', 'clamp escaped or NaN produced');
  }

  // 5 — behind-target hides the marker
  {
    const m = projectMarker(0, 0, 0.4, -Math.sin(0.4) * 100, -Math.cos(0.4) * 100, 0, 16 / 9);
    m.behind
      ? pass('behind-hide', 'Target behind camera hides the marker',
        `target placed 100 m astern → behind=true, HUD skips render (raw ${m.rawX.toFixed(2)})`)
      : fail('behind-hide', 'Target behind camera hides the marker', 'behind flag not raised');
  }

  // 6 — handoff radius distances format sanely (HUD shows Math.round(dist) m)
  {
    const near = projectMarker(0, 0, 0, 0, -6.2, 0, 16 / 9);
    const far = projectMarker(0, 0, 0, 3000, -4200, 0, 16 / 9);
    !Number.isNaN(near.dist) && !Number.isNaN(far.dist)
      ? pass('dist-format', 'Distance readout stays finite',
        `near ${near.dist.toFixed(1)} m (inside handoff), far ${Math.round(far.dist)} m — no NaN`)
      : fail('dist-format', 'Distance readout stays finite', 'NaN distance');
  }

  // 7 — shape distinctness per surface (accessibility rule: shape + colour, never colour alone)
  {
    const bySurface = new Map<string, string[]>();
    for (const s of MARKER_SHAPES) {
      const list = bySurface.get(s.surface) ?? [];
      list.push(`${s.id}:${s.shape}`);
      bySurface.set(s.surface, list);
    }
    const clashes: string[] = [];
    for (const [surface, list] of bySurface) {
      const shapes = list.map((e) => e.split(':')[1]);
      if (new Set(shapes).size !== shapes.length) clashes.push(`${surface} (${list.join(', ')})`);
    }
    clashes.length === 0
      ? pass('shape-distinct', 'Marker shapes unique per surface',
        [...bySurface.entries()].map(([s, l]) => `${s}: ${l.map((e) => e.split(':')[1]).join(' · ')}`).join(' ｜ '))
      : fail('shape-distinct', 'Marker shapes unique per surface', `clash on ${clashes.join('; ')}`);
  }

  // 8 — minimap marker contrast ≥ 3:1 against panel bg, per palette
  {
    const rows: string[] = [];
    let worstRatio = Infinity;
    let worstPair = '';
    let fails = 0;
    for (const p of PALETTES) {
      for (const [name, col] of [['waypoint', p.waypoint], ['convoy', p.convoy], ['chase', p.chase], ['player', p.player]] as const) {
        const r = contrast(col, p.bg);
        if (grade(r) === 'fail') fails++;
        if (r < worstRatio) { worstRatio = r; worstPair = `${p.id}/${name}`; }
      }
      rows.push(`${p.id} worst ${Math.min(contrast(p.waypoint, p.bg), contrast(p.convoy, p.bg), contrast(p.chase, p.bg), contrast(p.player, p.bg)).toFixed(1)}:1`);
    }
    fails === 0
      ? pass('contrast', 'All markers ≥ 3:1 on every palette',
        `${rows.join(' · ')} — tightest pair ${worstPair} at ${worstRatio.toFixed(2)}:1`)
      : fail('contrast', 'All markers ≥ 3:1 on every palette', `${fails} pair(s) below 3:1; tightest ${worstPair} ${worstRatio.toFixed(2)}:1`);
  }

  // 9 — handedness audit: bearing construction in Bike vs CameraRig (warn-only)
  {
    // Bike.tsx: heading = atan2(fwd.x, -fwd.z)  → true bearing, 0 = north (-z)
    // CameraRig.tsx: _fwd = (sin h, 0, cos h)  → mirrored in z vs bearing definition
    const h = 0.9; // arbitrary probe
    const bikeFwd = { x: Math.sin(h), z: -Math.cos(h) }; // inverting atan2(f.x, -f.z)=h
    const camFwd = { x: Math.sin(h), z: Math.cos(h) };
    const mirrored = Math.abs(bikeFwd.x - camFwd.x) < 1e-9 && Math.abs(bikeFwd.z + camFwd.z) < 1e-9;
    if (mirrored) {
      out.push({
        id: 'handedness',
        label: 'Bearing→camera handedness audit',
        status: 'warn',
        detail:
          'Bike.tsx writes heading = atan2(fwd.x, −fwd.z) (bearing; 0 = north), but CameraRig.tsx reconstructs forward as (sin h, 0, cos h) — mirrored in z. ' +
          'The compass/minimap chain is internally consistent with the bearing form; the chase camera’s reconstruction flips it. ' +
          'If the camera ever drives gameplay (it drives the marker projection), targets ahead/behind and E/W swap. Flagged for the app builder — this lab does not patch game code.',
      });
    } else {
      pass('handedness', 'Bearing→camera handedness audit', 'camera forward matches bearing reconstruction');
    }
  }

  // 10 — bearingTo sanity: target at due east is E
  {
    const b = bearingTo(0, 0, 100, 0);
    Math.abs(b - Math.PI / 2) < 1e-9
      ? pass('bearing-east', 'Due-east target reads E on compass',
        `bearingTo(east) = ${(b * 180 / Math.PI).toFixed(1)}° (tick E sits at +90°)`)
      : fail('bearing-east', 'Due-east target reads E on compass', `got ${(b * 180 / Math.PI).toFixed(1)}°`);
  }

  return out;
}
