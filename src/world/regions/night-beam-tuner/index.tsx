/**
 * NIGHT BEAM TUNER — the dusk/night headlight bench.
 *
 * The player-spec bike sits parked on a salt-pan corridor walled by glass
 * canyon, running the game's own sky palette and fog formula. The Headlight
 * geometry mirrors src/game/Bike.tsx 1:1 (mount points, cone, dusk ramp) with
 * every constant live: cone angle, intensity, decay, cutoff, penumbra, aim,
 * dust-cone sheen, lamp glow. Range gates every 5 m give the throw a ruler;
 * teal ground frames mark the 20–30 m "read band" from DESIGN.md. A canvas-2D
 * scanline charts analytic ground illuminance (exact three.js spot model) and
 * the export button drops paste-ready JSX props on the clipboard.
 *
 * Region-registry note (workshed policy): this is a lab, so meta.json +
 * anchors.json describe a harmless off-world bench and the default export
 * carries meta/anchors statics — the game streams nothing from it.
 */
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import { withBase } from '../../../lib/base';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { BeamScene } from './Scene';
import { BeamPanel } from './Panel';
import { BeamScanline } from './Scanline';
import './tuner.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function NightBeamTuner() {
  const [started, setStarted] = useState(false);

  return (
    <div className="nbt-root">
      <div className="nbt-canvas">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [4.6, 3.0, -7.2], fov: 55, near: 0.3, far: 2600 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <BeamScene />
        </Canvas>
      </div>

      {started && (
        <>
          <p className="nbt-hint">
            violet night rig · <b>teal frames = 20–30 m read band</b> · the bike is parked, the beam is yours
          </p>
          <BeamPanel />
          <BeamScanline />
        </>
      )}

      {!started && (
        <div className="nbt-splash">
          <div className="nbt-splash-card">
            <div
              className="nbt-splash-art"
              style={{ backgroundImage: `url(${withBase('images/work/night-beam-tuner.jpg')})` }}
              role="img"
              aria-label="Concept art of a hover-bike parked on a night salt pan between glass canyon walls, its headlight reading the road ahead"
            />
            <div className="nbt-splash-body">
              <h1>Night Beam Tuner</h1>
              <p>
                Kessa-9 goes properly dark after the second moon sets, and a courier who
                can't read the road twenty metres out is a courier walking home. This bench
                parks your bike on a salt corridor between glass canyon walls and hands you
                the bolts of the game headlight — angle, intensity, decay, aim, the dust in
                the cone. Scrub the sky, watch the scanline, and find the tune that lights
                the far gate without turning the salt under your nose into a searchlight pool.
              </p>
              <button className="nbt-btn primary big" onClick={() => setStarted(true)}>
                Light the pan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = NightBeamTuner as typeof NightBeamTuner & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
