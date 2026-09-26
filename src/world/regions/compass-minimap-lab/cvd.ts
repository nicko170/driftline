/**
 * cvd — colour-vision-deficiency simulation for the shape-safety proof.
 * Machado, Oliveira & Fernandes (2009) matrices at severity 1.0, applied in
 * sRGB space per-pixel. The three canvases this lab renders are tiny, so a
 * full getImageData pass per state change is cheap and honest — what you see
 * is what a deutan/protan/tritan player sees.
 */

export type CvdType = 'deutan' | 'protan' | 'tritan';

export const CVD_LABELS: Record<CvdType, string> = {
  deutan: 'Deuteranopia (~5% of men)',
  protan: 'Protanopia (~1%)',
  tritan: 'Tritanopia (rare)',
};

const MATRICES: Record<CvdType, number[]> = {
  protan: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deutan: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.011820, 0.042940, 0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.303900,
  ],
};

/** Draw `src` onto `dst` through the CVD matrix. Both canvases same size. */
export function simulateCvd(src: HTMLCanvasElement, dst: HTMLCanvasElement, type: CvdType): void {
  const sctx = src.getContext('2d');
  const dctx = dst.getContext('2d');
  if (!sctx || !dctx) return;
  dctx.clearRect(0, 0, dst.width, dst.height);
  const img = sctx.getImageData(0, 0, src.width, src.height);
  const data = img.data;
  const m = MATRICES[type];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = Math.min(255, Math.max(0, r * m[0] + g * m[1] + b * m[2]));
    data[i + 1] = Math.min(255, Math.max(0, r * m[3] + g * m[4] + b * m[5]));
    data[i + 2] = Math.min(255, Math.max(0, r * m[6] + g * m[7] + b * m[8]));
    // alpha untouched — panel translucency survives simulation
  }
  // getImageData of src was mutated in place; write it to dst
  dctx.putImageData(img, 0, 0);
}
