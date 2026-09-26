/**
 * DUST-LAB — the dust & particle bench.
 *
 * The driftline dust trail is one of the most-seen effects in the game, so it
 * gets a tuning bench: a ghost courier auto-laps a test pan with three surface
 * zones (salt / sand / glass) while every emitter constant is live-editable.
 * "Copy JSON" emits constants that drop straight into src/game/DustTrail.tsx.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` + `anchors.json`
 * describe a harmless off-world bench (center [5400, 5200]) and the default
 * export carries `meta`/`anchors` statics — the game streams nothing from it.
 */
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { LabScene } from './Scene';
import { LabPanel } from './Panel';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function DustLab() {
  return (
    <div className="dlp-root">
      <div className="dlp-canvas">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [40, 46, 190], fov: 52, near: 0.5, far: 3200 }}
          gl={{ antialias: true }}
        >
          <LabScene />
        </Canvas>
      </div>
      <p className="dlp-hint">drag to orbit · the ghost never stops</p>
      <LabPanel />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = DustLab as typeof DustLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
