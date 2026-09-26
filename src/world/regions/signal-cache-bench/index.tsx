/**
 * SIGNAL CACHE SCOUT BENCH — readability range for the exploration pickup.
 *
 * The signal cache (weathered tripod + floating lore-violet octahedron +
 * whisper glimmer) is the game's quietest beacon: no sky beam, no holo hoist,
 * discovery-driven. This bench lines the shipping assembly up on a distance
 * ladder that runs past the 340 m hail cutoff, against the real day/dusk/
 * night sky keyframes and a storm-dust filter, then judges 3D beacon and 2D
 * chrome together: live replicas of the HUD hint chip (⟡ faint signal · N m,
 * wired to camera distance and dropping out past 340 m like the store logic)
 * and the minimap open-diamond sit on the stage, and the CVD feColorMatrix
 * filter wraps the whole stage so everything is simulated at once. Sliders
 * tune emissive/glimmer/ring; contrast tables grade them with honest bars;
 * a separability table measures the reserved violet against the mission
 * colours under all three deficiencies.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [9400, 8800])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { DEFAULT_CONFIG, STORMS, type BenchConfig } from './spec';
import { BenchScene } from './Scene';
import { BenchPanel } from './Panel';
import { MinimapReplica } from './MinimapReplica';
import { CvdFilterDefs, cssFilter } from './cvd';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function SignalCacheBench() {
  const [cfg, setCfg] = useState<BenchConfig>(DEFAULT_CONFIG);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const filter = cssFilter(cfg.cvd);
  const storm = STORMS[cfg.storm];

  return (
    <div className="scb-root">
      <CvdFilterDefs />
      <div className="scb-stage" style={filter ? { filter } : undefined}>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [18, 12, 42], fov: 55, near: 0.5, far: 4200 }}
          gl={{ antialias: true }}
        >
          <BenchScene cfg={cfg} chipRef={chipRef} />
        </Canvas>
        {storm.screenTint > 0 && <div className="scb-storm-tint" style={{ opacity: storm.screenTint }} aria-hidden="true" />}
        {/* shipping HUD replica — text/dropout driven by ChipProbe in the scene */}
        <div ref={chipRef} className="scb-chip" aria-hidden="true">
          ⟡ faint signal · — m
        </div>
        <MinimapReplica cfg={cfg} />
        <p className="scb-hint">
          drag to orbit · scroll to dolly — past 340 m the chip drops out, like the game
          {cfg.cvd !== 'none' ? ` · stage is simulating ${cfg.cvd}` : ''}
        </p>
      </div>
      <BenchPanel cfg={cfg} onChange={setCfg} />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = SignalCacheBench as typeof SignalCacheBench & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
