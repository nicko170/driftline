/**
 * Skybox & Day Cycle Tuner — scrub the DRIFTLINE palette over a bare dune vista,
 * tune fog/sun/stars, copy the result as JSON. Art: cleansing palette, big sky.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` + `anchors.json`
 * describe a harmless off-world bench (center [5000,5000]) and the default
 * export carries `meta`/`anchors` statics — the game streams nothing from it.
 */
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { TunerScene } from './Scene';
import { TunerPanel } from './Panel';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function SkyboxTuner() {
  return (
    <div className="skt-root">
      <div className="skt-canvas">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [10, 30, 170], fov: 55, near: 0.5, far: 4200 }}
          gl={{ antialias: true }}
        >
          <TunerScene />
        </Canvas>
      </div>
      <p className="skt-hint">drag to orbit · scrub the sky</p>
      <TunerPanel />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = SkyboxTuner as typeof SkyboxTuner & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
