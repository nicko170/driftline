/**
 * palettes — four time-of-day minimap palettes (day / dusk / night / storm),
 * each a candidate replacement for the single fixed palette in HUD.tsx's
 * drawMinimap(). WCAG contrast is measured live so the table can't lie.
 * Values stay inside DESIGN.md token families (amber/teal/rust/bone on ink).
 */

export interface MinimapPalette {
  id: string;
  label: string;
  /** circular panel background */
  bg: string;
  /** region disc fill + ring */
  regionFill: string;
  regionRing: string;
  /** marker colours — shapes carry the meaning, colours reinforce */
  waypoint: string;
  convoy: string;
  chase: string;
  player: string;
  /** storm wedge fill + edge */
  stormFill: string;
  stormEdge: string;
  /** faint range grid */
  grid: string;
}

export const PALETTES: MinimapPalette[] = [
  {
    id: 'day',
    label: 'Salt noon',
    bg: '#241E33',
    regionFill: 'rgba(176, 124, 58, 0.18)',
    regionRing: 'rgba(217, 164, 91, 0.55)',
    waypoint: '#FFB454',
    convoy: '#57C4B8',
    chase: '#FF7A4D',
    player: '#F3EEE2',
    stormFill: 'rgba(228, 87, 46, 0.30)',
    stormEdge: 'rgba(255, 122, 77, 0.85)',
    grid: 'rgba(228, 215, 190, 0.10)',
  },
  {
    id: 'dusk',
    label: 'Amber hour',
    bg: '#221A35',
    regionFill: 'rgba(179, 80, 46, 0.20)',
    regionRing: 'rgba(217, 164, 91, 0.5)',
    waypoint: '#FFC969',
    convoy: '#6FD8CC',
    chase: '#FF8A5C',
    player: '#F3EEE2',
    stormFill: 'rgba(228, 87, 46, 0.34)',
    stormEdge: 'rgba(255, 138, 92, 0.9)',
    grid: 'rgba(228, 215, 190, 0.10)',
  },
  {
    id: 'night',
    label: 'Violet watch',
    bg: '#14101F',
    regionFill: 'rgba(87, 196, 184, 0.10)',
    regionRing: 'rgba(87, 196, 184, 0.42)',
    waypoint: '#FFB454',
    convoy: '#7FE6DA',
    chase: '#FF8A5C',
    player: '#FFFFFF',
    stormFill: 'rgba(228, 87, 46, 0.32)',
    stormEdge: 'rgba(255, 122, 77, 0.9)',
    grid: 'rgba(228, 215, 190, 0.08)',
  },
  {
    id: 'storm',
    label: 'Wall incoming',
    bg: '#1B1526',
    regionFill: 'rgba(126, 51, 32, 0.28)',
    regionRing: 'rgba(179, 80, 46, 0.6)',
    waypoint: '#FFD98A',
    convoy: '#7FE6DA',
    chase: '#FFA07A',
    player: '#FFFFFF',
    stormFill: 'rgba(228, 87, 46, 0.40)',
    stormEdge: 'rgba(255, 160, 122, 0.95)',
    grid: 'rgba(228, 87, 46, 0.12)',
  },
];

/* ---------- WCAG contrast (measured, not asserted) ---------- */

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chanLum(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance; rgba() colours are composited over the given background. */
export function relLum(color: string, overBg?: string): number {
  let rgb = hexToRgb(color);
  if (!rgb) {
    const m = /rgba?\(([\d. +\-eE]+)\s*,\s*([\d. +\-eE]+)\s*,\s*([\d. +\-eE]+)(?:\s*,\s*([\d. +\-eE]+))?\)/.exec(color);
    if (!m) return 0;
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    rgb = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
    if (a < 1 && overBg) {
      const bg = hexToRgb(overBg);
      if (bg) rgb = rgb.map((c, i) => c * a + (bg[i] as number) * (1 - a)) as [number, number, number];
    }
  }
  const [r, g, b] = rgb;
  return 0.2126 * chanLum(r) + 0.7152 * chanLum(g) + 0.0722 * chanLum(b);
}

export function contrast(fg: string, bg: string): number {
  const l1 = relLum(fg, bg);
  const l2 = relLum(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = 'fail' | 'ui' | 'aa' | 'aaa';

export function grade(ratio: number): ContrastGrade {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'ui'; // WCAG 1.4.11 non-text UI components
  return 'fail';
}
