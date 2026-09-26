/**
 * Signal Cache Scout Bench — colour-vision-deficiency simulation.
 * Machado/Oliveira/Fernandes (2009) matrices at severity 1.0, shipped two ways:
 *
 *  1. SVG <feColorMatrix> filters applied as CSS `filter: url(#…)` to the bench
 *     stage div — the compositor runs the same matrix on the WebGL canvas AND
 *     the DOM replicas (HUD chip, minimap, storm tint), so the whole stack is
 *     simulated, not just the 3D beacon.
 *  2. The raw matrices exported for JS-side swatch simulation, so panel
 *     swatches and contrast tables agree with the filtered stage.
 *
 * (Sister implementation to waypoint-glow-up/cvd.tsx — kept self-contained so
 * either folder can evolve without breaking the other.)
 */

export type CvdId = 'none' | 'protan' | 'deutan' | 'tritan';

export const CVD_LIST: { id: CvdId; label: string; note: string }[] = [
  { id: 'none', label: 'typical vision', note: 'no simulation' },
  { id: 'protan', label: 'protanopia', note: '~1% of players · red cone absent' },
  { id: 'deutan', label: 'deuteranopia', note: '~5% of men · green cone absent' },
  { id: 'tritan', label: 'tritanopia', note: 'rare · blue cone absent' },
];

/** 3×3 sRGB matrices, severity 1.0 (Machado et al. 2009). */
export const CVD_MATRICES: Record<Exclude<CvdId, 'none'>, readonly number[]> = {
  protan: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deutan: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.01182, 0.04294, 0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.3039,
  ],
};

/** CSS filter value for the stage wrapper. */
export function cssFilter(cvd: CvdId): string | undefined {
  return cvd === 'none' ? undefined : `url(#scb-cvd-${cvd})`;
}

/** Hidden SVG holding the three feColorMatrix filters (5×4 matrix, alpha untouched). */
export function CvdFilterDefs() {
  return (
    <svg className="scb-filters" width={0} height={0} aria-hidden="true" focusable="false">
      <defs>
        {(Object.keys(CVD_MATRICES) as Exclude<CvdId, 'none'>[]).map((id) => {
          const m = CVD_MATRICES[id];
          const values = [
            `${m[0]} ${m[1]} ${m[2]} 0 0`,
            `${m[3]} ${m[4]} ${m[5]} 0 0`,
            `${m[6]} ${m[7]} ${m[8]} 0 0`,
            '0 0 0 1 0',
          ].join(' ');
          return (
            <filter key={id} id={`scb-cvd-${id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={values} />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}
