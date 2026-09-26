/**
 * WAYPOINT & BEACON BENCH — night-range test of every shipping mission marker.
 *
 * The game leans on shape-anchored markers (amber diamond objective, teal
 * square convoy, rust triangle chase, red storm disc, race-gate tori) whose
 * legibility had never been measured end-to-end. This bench lines the whole
 * family up on a distance-marked night firing lane, cycles them through
 * colourways and spacings, and runs a compositor-level colour-blindness
 * simulation (SVG feColorMatrix over the live WebGL canvas) to prove the
 * accessibility rule with pixels: shape is the identity, colour is decoration.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [5800, 6600]) and
 * the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { DEFAULT_CONFIG, type BenchConfig } from './spec';
import { BenchScene } from './Scene';
import { BenchPanel } from './Panel';
import { CvdFilterDefs, cssFilter } from './cvd';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function WaypointGlowUp() {
  const [cfg, setCfg] = useState<BenchConfig>(DEFAULT_CONFIG);
  const filter = cssFilter(cfg.cvd);

  return (
    <div className="wgl-root">
      <CvdFilterDefs />
      <div className={`wgl-canvas${filter ? ' wgl-filtered' : ''}`} style={filter ? { filter } : undefined}>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [30, 22, 74], fov: 55, near: 0.5, far: 3400 }}
          gl={{ antialias: true }}
        >
          <BenchScene cfg={cfg} />
        </Canvas>
      </div>
      <p className="wgl-hint">
        drag to orbit · scroll to dolly{cfg.cvd !== 'none' ? ` · canvas is simulating ${cfg.cvd}` : ''}
      </p>
      <BenchPanel cfg={cfg} onChange={setCfg} />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = WaypointGlowUp as typeof WaypointGlowUp & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
