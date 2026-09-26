/**
 * pixels — the QC darkroom. Loads each portrait through an offscreen canvas
 * (same-origin, so no taint) and measures what the shipped UI will show:
 *
 *  - a 16-bin luminance histogram + the share of pixels sitting in the
 *    DESIGN.md "warm key" window (mid luminance, warm hue, dressy enough);
 *  - chroma-weighted mean hue + saturation, for drift against faction chips;
 *  - Sobel edge density plus a background-ring vs face-centre separation
 *    score, composed into a silhouette readability 0–100;
 *  - a 64px cover-crop re-measure (the dialogue card renders exactly
 *    64×64, object-fit: cover — ui.css .dialogue-portrait);
 *  - Vienot, Brettel & Mollon (1999) dichromacy simulation in linear light
 *    for the accessibility pass (deutan / protan / tritan + grayscale).
 *
 * Everything runs once per portrait and caches; analysis resolves async and
 * the wall fills its tally in as films develop. No game state touched.
 */

export const SAMPLE = 96;
const CROP = 64;

/** Warm-key window (DESIGN.md "warm flat shading, long shadows"). */
export const KEY_BAND = { lumaMin: 0.3, lumaMax: 0.8, hueMin: 10, hueMax: 80, satMin: 0.12 };

/* ---------------- colour maths ------------------------------------------- */

/** sRGB (0–255) → hsl (h 0–360, s/l 0–1). */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0.5];
  const v = parseInt(m[1], 16);
  return rgbToHsl((v >> 16) & 255, (v >> 8) & 255, v & 255);
}

/** Smallest circular distance between two hues, in degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function hslCss(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
}

/* ---------------- analysis types ----------------------------------------- */

export interface CropReport {
  edgeDensity: number;
  /** std-dev of luminance across the face disc at dialogue size */
  centreStd: number;
  warmShare: number;
  canvas: HTMLCanvasElement;
}

export interface PixelAnalysis {
  id: string;
  naturalW: number;
  naturalH: number;
  /** 16 luminance bins, each a 0–1 share of the frame */
  bins: number[];
  lumaMean: number;
  lumaMedian: number;
  /** share of pixels inside KEY_BAND */
  warmShare: number;
  meanSat: number;
  /** chroma-weighted mean hue, or null when the frame is near-neutral */
  domHue: number | null;
  /** 0–1 share of pixels carrying enough chroma to vote on hue */
  chromaMass: number;
  edgeDensity: number;
  /** background-ring vs face-centre separation, 0–1 */
  separation: number;
  /** composite silhouette readability, 0–100 */
  silhouette: number;
  crop64: CropReport;
  /** the 96px cover-cropped source the stats were read from */
  canvas: HTMLCanvasElement;
}

/* ---------------- readback ----------------------------------------------- */

function coverCrop(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas;
}

interface GridStats {
  luma: Float32Array;
  hue: Float32Array;
  sat: Float32Array;
}

function gridStats(canvas: HTMLCanvasElement, size: number): GridStats | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, size, size).data;
  const luma = new Float32Array(size * size);
  const hue = new Float32Array(size * size);
  const sat = new Float32Array(size * size);
  for (let px = 0, i = 0; i < data.length; i += 4, px++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    luma[px] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const [h, s] = rgbToHsl(r, g, b);
    hue[px] = h;
    sat[px] = s;
  }
  return { luma, hue, sat };
}

/** Fraction of pixels whose Sobel gradient magnitude clears the threshold. */
function edgeDensity(luma: Float32Array, size: number, threshold: number): number {
  let hits = 0, total = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const gx =
        luma[i - size + 1] + 2 * luma[i + 1] + luma[i + size + 1] -
        (luma[i - size - 1] + 2 * luma[i - 1] + luma[i + size - 1]);
      const gy =
        luma[i + size - 1] + 2 * luma[i + size] + luma[i + size + 1] -
        (luma[i - size - 1] + 2 * luma[i - size] + luma[i - size + 1]);
      if (Math.abs(gx) + Math.abs(gy) > threshold) hits++;
      total++;
    }
  }
  return total ? hits / total : 0;
}

function warmShareOf(grid: GridStats, count: number): number {
  let warm = 0;
  for (let px = 0; px < count; px++) {
    const l = grid.luma[px], h = grid.hue[px], s = grid.sat[px];
    if (
      l >= KEY_BAND.lumaMin && l <= KEY_BAND.lumaMax &&
      s >= KEY_BAND.satMin && h >= KEY_BAND.hueMin && h <= KEY_BAND.hueMax
    ) warm++;
  }
  return count ? warm / count : 0;
}

function analyzeGrid(id: string, img: HTMLImageElement, canvas: HTMLCanvasElement): PixelAnalysis | null {
  const grid = gridStats(canvas, SAMPLE);
  if (!grid) return null;
  const count = SAMPLE * SAMPLE;

  /* luminance: histogram, mean, median */
  const bins = new Array<number>(16).fill(0);
  let lumaSum = 0;
  for (let px = 0; px < count; px++) {
    const l = grid.luma[px];
    bins[Math.min(15, Math.floor(l * 16))]++;
    lumaSum += l;
  }
  let acc = 0, lumaMedian = 1;
  for (let b = 0; b < 16; b++) {
    acc += bins[b];
    if (acc >= count / 2) { lumaMedian = (b + 0.5) / 16; break; }
  }
  for (let b = 0; b < 16; b++) bins[b] /= count;

  /* chroma: mean saturation + weighted circular mean hue */
  let satSum = 0, vx = 0, vy = 0, wSum = 0, voters = 0;
  for (let px = 0; px < count; px++) {
    const s = grid.sat[px], l = grid.luma[px];
    satSum += s;
    if (s < 0.15) continue;
    // weight: saturation, damped at the crushed/blown luminance extremes
    const w = s * Math.max(0.2, 1 - Math.abs(l - 0.5) * 1.4);
    const rad = (grid.hue[px] * Math.PI) / 180;
    vx += Math.cos(rad) * w;
    vy += Math.sin(rad) * w;
    wSum += w;
    voters++;
  }
  const domHue = wSum > count * 0.02 ? ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360 : null;

  /* silhouette: edge density + ring-vs-centre separation */
  const density = edgeDensity(grid.luma, SAMPLE, 0.22);
  const ringWidth = 10, cx = SAMPLE / 2, cy = SAMPLE * 0.48, rx = 26, ry = 30;
  let ringN = 0, ringL = 0, ringS = 0, ringHx = 0, ringHy = 0;
  let ctrN = 0, ctrL = 0, ctrS = 0, ctrHx = 0, ctrHy = 0;
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      const px = y * SAMPLE + x;
      const inRing = x < ringWidth || y < ringWidth || x >= SAMPLE - ringWidth || y >= SAMPLE - ringWidth;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const inFace = dx * dx + dy * dy <= 1;
      if (inRing === inFace) continue;
      const rad = (grid.hue[px] * Math.PI) / 180;
      if (inRing) {
        ringN++; ringL += grid.luma[px]; ringS += grid.sat[px];
        ringHx += Math.cos(rad) * grid.sat[px]; ringHy += Math.sin(rad) * grid.sat[px];
      } else {
        ctrN++; ctrL += grid.luma[px]; ctrS += grid.sat[px];
        ctrHx += Math.cos(rad) * grid.sat[px]; ctrHy += Math.sin(rad) * grid.sat[px];
      }
    }
  }
  const dL = ringN && ctrN ? Math.abs(ctrL / ctrN - ringL / ringN) : 0;
  // chroma-plane distance between the two regions' mean (h, s) vectors
  const rhx = ringN ? ringHx / ringN : 0, rhy = ringN ? ringHy / ringN : 0;
  const chx = ctrN ? ctrHx / ctrN : 0, chy = ctrN ? ctrHy / ctrN : 0;
  const dC = Math.hypot(chx - rhx, chy - rhy);
  const dS = ringN && ctrN ? Math.abs(ctrS / ctrN - ringS / ringS) : 0;
  const separation = Math.min(1, dL * 0.55 + dC * 0.6 + dS * 0.25);

  // density has a sweet zone around 9% ~ quiet background, decisive strokes;
  // penalise mush (too low) harder than noise (too high)
  const eScore = density < 0.09
    ? Math.exp(-((0.09 - density) ** 2) / (2 * 0.045 ** 2))
    : Math.exp(-((density - 0.09) ** 2) / (2 * 0.09 ** 2));
  const sScore = Math.min(1, separation / 0.3);
  const silhouette = Math.round(100 * (0.55 * eScore + 0.45 * sScore));

  /* the shipped 64px dialogue crop, re-measured */
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = CROP;
  cropCanvas.height = CROP;
  const cctx = cropCanvas.getContext('2d', { willReadFrequently: true });
  let crop: CropReport = { edgeDensity: 0, centreStd: 0, warmShare: 0, canvas: cropCanvas };
  if (cctx) {
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(canvas, 0, 0, CROP, CROP);
    const cg = gridStats(cropCanvas, CROP);
    if (cg) {
      const d = edgeDensity(cg.luma, CROP, 0.24);
      // face disc at dialogue size: centre 24×24
      const half = 12, mid = CROP / 2;
      let n = 0, m = 0;
      for (let y = mid - half; y < mid + half; y++)
        for (let x = mid - half; x < mid + half; x++) { m += cg.luma[y * CROP + x]; n++; }
      const mean = m / n;
      let v = 0;
      for (let y = mid - half; y < mid + half; y++)
        for (let x = mid - half; x < mid + half; x++) { const dlt = cg.luma[y * CROP + x] - mean; v += dlt * dlt; }
      crop = {
        edgeDensity: d,
        centreStd: Math.sqrt(v / n),
        warmShare: warmShareOf(cg, CROP * CROP),
        canvas: cropCanvas,
      };
    }
  }

  return {
    id,
    naturalW: img.naturalWidth,
    naturalH: img.naturalHeight,
    bins,
    lumaMean: lumaSum / count,
    lumaMedian,
    warmShare: warmShareOf(grid, count),
    meanSat: satSum / count,
    domHue,
    chromaMass: voters / count,
    edgeDensity: density,
    separation,
    silhouette,
    crop64: crop,
    canvas,
  };
}

const cache = new Map<string, Promise<PixelAnalysis | null>>();

/** Analyse a portrait URL once; null when the file is missing/unreadable. */
export function analyzePortrait(id: string, url: string): Promise<PixelAnalysis | null> {
  let p = cache.get(id);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(analyzeGrid(id, img, coverCrop(img, SAMPLE)));
      img.onerror = () => resolve(null);
      img.src = url;
    });
    cache.set(id, p);
  }
  return p;
}

/* ---------------- Vienot et al. (1999) CVD simulation -------------------- */

export type CvdType = 'protan' | 'deutan' | 'tritan' | 'gray';

export const CVD_LABELS: Record<CvdType, string> = {
  protan: 'Protanopia (~1% of men)',
  deutan: 'Deuteranopia (~5% of men)',
  tritan: 'Tritanopia (rare)',
  gray: 'Grayscale (value check)',
};

/** Vienot, Brettel & Mollon 1999, dichromat transforms in linear RGB. */
const VIENOT: Record<Exclude<CvdType, 'gray'>, number[]> = {
  protan: [
    0, 2.02344, -2.52581,
    0, 1, 0,
    0, 0, 1,
  ],
  deutan: [
    1, 0, 0,
    0.494207, 0, 1.24827,
    0, 0, 1,
  ],
  tritan: [
    1, 0, 0,
    0, 1, 0,
    -0.395913, 0.801109, 0,
  ],
};

// gamma lookup tables — built once, reused per pixel
const TO_LIN = new Float32Array(256);
const TO_SRGB = new Float32Array(4096);
for (let i = 0; i < 256; i++) TO_LIN[i] = Math.pow(i / 255, 2.2);
for (let i = 0; i < 4096; i++) TO_SRGB[i] = Math.pow(i / 4095, 1 / 2.2) * 255;

/** Draw `src` onto `dst` through a CVD (or value-only grayscale) transform. */
export function renderCvd(src: HTMLCanvasElement, dst: HTMLCanvasElement, type: CvdType): void {
  const sctx = src.getContext('2d', { willReadFrequently: true });
  const dctx = dst.getContext('2d');
  if (!sctx || !dctx) return;
  const img = sctx.getImageData(0, 0, src.width, src.height);
  const data = img.data;
  const m = type === 'gray' ? null : VIENOT[type];
  for (let i = 0; i < data.length; i += 4) {
    const rl = TO_LIN[data[i]], gl = TO_LIN[data[i + 1]], bl = TO_LIN[data[i + 2]];
    let r2: number, g2: number, b2: number;
    if (m) {
      r2 = rl * m[0] + gl * m[1] + bl * m[2];
      g2 = rl * m[3] + gl * m[4] + bl * m[5];
      b2 = rl * m[6] + gl * m[7] + bl * m[8];
    } else {
      r2 = g2 = b2 = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    }
    const qi = (v: number) => Math.max(0, Math.min(4095, Math.round(v * 4095)));
    data[i] = TO_SRGB[qi(r2)];
    data[i + 1] = TO_SRGB[qi(g2)];
    data[i + 2] = TO_SRGB[qi(b2)];
  }
  dctx.clearRect(0, 0, dst.width, dst.height);
  dctx.putImageData(img, 0, 0);
}
