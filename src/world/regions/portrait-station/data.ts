/**
 * data — the booth's rulebook. Faction palette chips (DESIGN.md), the wall
 * roster from the real character library, the four QC checks (warm key,
 * faction drift, silhouette, 64px card) with their thresholds and corrective
 * notes, the overall grade, wall-neighbour maths for the context hang, and
 * the shot-list composer that turns a failed check into a repaint brief.
 *
 * Self-contained: borrows the game's *data* (characters, region names) but
 * none of its runtime — parallel builders can't break the bench.
 */
import { characters, type Character } from '../../../dialogue/library';
import { REGIONS } from '../../registry';
import { hexToHsl, hueDistance, type PixelAnalysis } from './pixels';

/* ---------------- factions & roster -------------------------------------- */

export interface FactionInfo {
  id: string;
  name: string;
  color: string; // palette chip — DESIGN.md
  glyph: string; // shape signal — colour is never the only cue
  /** chip hue in degrees; null = neutral faction (chroma guard instead) */
  chipHue: number | null;
  chipSat: number;
}

const chip = (id: string, name: string, color: string, glyph: string, neutral = false): FactionInfo => {
  const [h, s] = hexToHsl(color);
  return { id, name, color, glyph, chipHue: neutral ? null : h, chipSat: s };
};

export const FACTIONS: Record<string, FactionInfo> = {
  driftline: chip('driftline', 'The Driftline', '#FFB454', '✦'),
  guild: chip('guild', 'Salt Guild', '#B07C3A', '◆'),
  choir: chip('choir', 'The Choir', '#57C4B8', '◉'),
  reclaimers: chip('reclaimers', 'The Reclaimers', '#B3502E', '▲'),
  // bone chips read on value and warmth, not hue — saturation guard instead
  independent: chip('independent', 'Independent', '#E4D7BE', '▣', true),
};

export const FACTION_ORDER = ['driftline', 'guild', 'choir', 'reclaimers', 'independent'];

export const factionOf = (c: Character): FactionInfo => FACTIONS[c.faction] ?? FACTIONS.independent;

export function regionName(slug: string): string {
  return REGIONS.get(slug)?.meta.name ?? slug;
}

export interface WallEntry {
  character: Character;
  faction: FactionInfo;
  declaredArt?: string;
}

const byName = (a: Character, b: Character) => a.name.localeCompare(b.name);

export const WALL: WallEntry[] = [...characters.values()].sort(byName).map((c) => ({
  character: c,
  faction: factionOf(c),
  declaredArt: c.portrait,
}));

/** Up to three same-faction wall neighbours for the context hang. */
export function wallNeighbours(c: Character, n = 3): Character[] {
  const fam = [...characters.values()].filter((o) => o.id !== c.id && factionOf(o).id === factionOf(c).id).sort(byName);
  if (fam.length <= n) return fam;
  const idx = fam.findIndex((o) => o.name.localeCompare(c.name) > 0);
  const start = Math.max(0, Math.min(fam.length - n, (idx === -1 ? fam.length : idx) - 1));
  return fam.slice(start, start + n);
}

/* ---------------- checks & grades ---------------------------------------- */

export type Grade = 'pass' | 'warn' | 'fail';

export interface Check {
  id: 'key' | 'palette' | 'silhouette' | 'card';
  label: string;
  grade: Grade;
  /** one-line measured reading, e.g. "42% in band · mean L 0.51" */
  reading: string;
  /** present on warn/fail — the note that lands on the shot list */
  fix?: string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function gradeAnalysis(c: Character, a: PixelAnalysis): Check[] {
  const f = factionOf(c);
  const out: Check[] = [];

  /* 1 — warm key -------------------------------------------------------- */
  const blown = a.lumaMean > 0.78;
  const keyGrade: Grade =
    a.warmShare >= 0.38 && !blown ? 'pass' : a.warmShare >= 0.22 ? 'warn' : 'fail';
  out.push({
    id: 'key',
    label: 'Warm key',
    grade: keyGrade,
    reading: `${pct(a.warmShare)} in band · mean ${a.lumaMean.toFixed(2)} · median ${a.lumaMedian.toFixed(2)}`,
    fix:
      keyGrade === 'pass'
        ? undefined
        : blown
          ? 'Frame reads blown out — pull the key light down into midtone (L 0.30–0.78).'
          : a.warmShare < 0.22
            ? 'Face sits outside the warm key — relight with a low warm sun, keep shadows ochre not grey.'
            : 'Warm share is thin — push more of the face into the sunlit side of the palette.',
  });

  /* 2 — faction drift ---------------------------------------------------- */
  let palGrade: Grade;
  let palReading: string;
  let palFix: string | undefined;
  if (f.chipHue === null) {
    palGrade = a.meanSat >= 0.1 && a.meanSat <= 0.45 ? 'pass' : a.meanSat <= 0.58 ? 'warn' : 'fail';
    palReading = `mean sat ${pct(a.meanSat)} · bone register 10–45%`;
    if (palGrade !== 'pass')
      palFix = `Independents wear bone, not carnival — keep saturation inside 10–45% so the ▣ chip stays honest.`;
  } else if (a.domHue === null) {
    palGrade = 'warn';
    palReading = `near-neutral frame · chip ${f.chipHue.toFixed(0)}° ${f.name}`;
    palFix = `No chroma to grade against — the ${f.name} accent never made it onto the canvas.`;
  } else {
    const drift = hueDistance(a.domHue, f.chipHue);
    palGrade = drift <= 38 && a.meanSat >= 0.1 ? 'pass' : drift <= 70 ? 'warn' : 'fail';
    palReading = `canvas ${a.domHue.toFixed(0)}° vs chip ${f.chipHue.toFixed(0)}° · drift ${drift.toFixed(0)}° · sat ${pct(a.meanSat)}`;
    if (palGrade !== 'pass') {
      palFix =
        a.meanSat < 0.1
          ? 'Canvas is washed out — let the faction accent carry some pigment.'
          : `Hue reads ${drift.toFixed(0)}° off the ${f.name} chip — nudge the palette toward ${f.color}.`;
    }
  }
  out.push({ id: 'palette', label: 'Faction drift', grade: palGrade, reading: palReading, fix: palFix });

  /* 3 — silhouette ------------------------------------------------------- */
  const silGrade: Grade = a.silhouette >= 55 ? 'pass' : a.silhouette >= 35 ? 'warn' : 'fail';
  out.push({
    id: 'silhouette',
    label: 'Silhouette',
    grade: silGrade,
    reading: `score ${a.silhouette}/100 · edges ${pct(a.edgeDensity)} · sep ${a.separation.toFixed(2)}`,
    fix:
      silGrade === 'pass'
        ? undefined
        : a.edgeDensity < 0.035
          ? 'Edges are mush — separate sitter from backdrop with a rim light and value contrast.'
          : a.edgeDensity > 0.16
            ? 'Backdrop is noisy — quiet the desert behind the sitter so the outline decides first.'
            : 'Figure and backdrop share a value — darken one, lighten the other.',
  });

  /* 4 — 64px card -------------------------------------------------------- */
  const cardGrade: Grade =
    a.crop64.centreStd >= 0.085 && a.crop64.edgeDensity >= 0.028
      ? 'pass'
      : a.crop64.centreStd >= 0.06
        ? 'warn'
        : 'fail';
  out.push({
    id: 'card',
    label: 'At 64px',
    grade: cardGrade,
    reading: `face σ ${a.crop64.centreStd.toFixed(3)} · edges ${pct(a.crop64.edgeDensity)}`,
    fix:
      cardGrade === 'pass'
        ? undefined
        : 'Features wash out at dialogue size — bigger value steps across the face, fewer tonal half-measures.',
  });

  return out;
}

export interface OverallGrade {
  letter: 'A' | 'B' | 'C' | 'R';
  glyph: string; // shape first — colour second
  label: string;
  score: number; // 0–8
}

const GRADE_POINTS: Record<Grade, number> = { pass: 2, warn: 1, fail: 0 };

export function overall(checks: Check[]): OverallGrade {
  const score = checks.reduce((s, c) => s + GRADE_POINTS[c.grade], 0);
  if (score >= 8) return { letter: 'A', glyph: '●', label: 'GALLERY', score };
  if (score >= 6) return { letter: 'B', glyph: '▲', label: 'HANG-READY', score };
  if (score >= 4) return { letter: 'C', glyph: '■', label: 'TOUCH-UP', score };
  return { letter: 'R', glyph: '✕', label: 'REPAINT', score };
}

/** Corrective one-liners from everything that isn't a pass. */
export function watchList(checks: Check[]): string[] {
  return checks.filter((c) => c.grade !== 'pass' && c.fix).map((c) => c.fix as string);
}

/* ---------------- shot-list composer ------------------------------------- */

/** The canonical shared style block from .ralph/DESIGN.md — keep in sync. */
export const STYLE_BLOCK =
  'Stylised low-poly 3D illustration, warm flat shading, frontier-western solarpunk; ' +
  'sun-bleached salt-white desert, ochre dunes, teal glass formations, rust-red machinery; ' +
  'long shadows, dusty air; no text, no watermark, no logo.';

/**
 * Draft the re-sitting brief from the character sheet plus whatever the QC
 * checks flagged — shot geometry first, corrective watch-list last, ready to
 * paste into the paint tool.
 */
export function shotList(c: Character, checks: Check[] | null): string {
  const f = factionOf(c);
  const lines: string[] = [
    `SHOT LIST — ${c.name} (${c.id})`,
    `Sitter: ${c.name}, ${c.role} — ${f.name}, out of ${regionName(c.home)}.`,
    `Appearance: ${c.appearance}`,
    `Voice to catch in the eyes: ${c.voice}`,
    `Palette accent: ${f.color} (${f.name} ${f.glyph}) — keep the frame's dominant hue within ~40° of the chip.`,
    `Frame: square head-and-shoulders, eyes in the upper third, quiet long-shadow backdrop off ${regionName(c.home)}; must survive a 64px cover crop with the face still readable.`,
    `Style: ${STYLE_BLOCK}`,
  ];
  const watch = checks ? watchList(checks) : [];
  if (checks === null) {
    lines.push('Watch: no sitting on file yet — this is the first pass, grade it on the wall after.');
  } else if (watch.length) {
    lines.push('Watch (from the last sitting\'s grade sheet):');
    for (const w of watch) lines.push(`  - ${w}`);
  } else {
    lines.push('Watch: last sitting graded clean — repaint only for likeness, hold the lighting recipe.');
  }
  return lines.join('\n');
}
