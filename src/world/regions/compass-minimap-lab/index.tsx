/**
 * COMPASS & MINIMAP LAB — the HUD navigation bench.
 *
 * A fake 1200 m test pan with draggable waypoint / convoy / chase / storm
 * anchors drives three linked instruments:
 *   · the game's compass pill + projected waypoint diamond (real HUD classes)
 *   · four candidate minimap palettes with measured WCAG contrast
 *   · a colour-blind simulation strip proving shapes survive CVD
 * An invariant suite fuzz-tests the exact formulas shipped in the HUD, and
 * "copy constants JSON" exports the tuned palettes for the game.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [5600, 5400]) and
 * the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { INITIAL_WORLD, type LabWorld } from './world';
import { WorldCanvas } from './WorldCanvas';
import { HudMirror } from './HudMirror';
import { MinimapLab } from './MinimapLab';
import { CvdStrip } from './CvdStrip';
import { ChecksPanel } from './ChecksPanel';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function CompassMinimapLab() {
  const [world, setWorld] = useState<LabWorld>(INITIAL_WORLD);

  const headingDeg = Math.round((((world.heading * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <div className="cml-root">
      <header
        className="cml-head"
        style={{ backgroundImage: `url(${withBase('images/work/compass-minimap-lab.jpg')})` }}
        role="img"
        aria-label="Holographic navigation instruments hovering over a hover-bike dashboard in a courier garage"
      >
        <div className="cml-head-veil">
          <h2>Compass &amp; Minimap Lab</h2>
          <p>
            Drag anchors around the test pan and watch the shipping HUD math respond. The invariant
            suite fuzzes the compass window, the marker clamp and the palette contrast so regressions
            show up here before they show up at 140 km/h.
          </p>
        </div>
        <div className="cml-controls" aria-label="Rider controls">
          <label className="cml-ctl">
            <span>heading {headingDeg}°</span>
            <input
              type="range" min={0} max={359} value={headingDeg}
              onChange={(e) => setWorld({ ...world, heading: (+e.target.value * Math.PI) / 180 })}
              aria-label="Player heading"
            />
          </label>
          <label className="cml-ctl">
            <span>speed {Math.round(world.speed * 3.4)} km/h</span>
            <input
              type="range" min={0} max={40} step={0.5} value={world.speed}
              onChange={(e) => setWorld({ ...world, speed: +e.target.value })}
              aria-label="Speed (drives chase camera FOV)"
            />
          </label>
          <label className="cml-ctl cml-ctl-inline">
            <input
              type="checkbox" checked={world.boosting}
              onChange={(e) => setWorld({ ...world, boosting: e.target.checked })}
              aria-label="Boosting"
            />
            <span>boost</span>
          </label>
          <button className="cml-copy" onClick={() => setWorld({ ...INITIAL_WORLD })}>
            reset pan
          </button>
        </div>
      </header>

      <div className="cml-grid">
        <WorldCanvas world={world} onChange={setWorld} />
        <div className="cml-col">
          <HudMirror world={world} />
          <ChecksPanel />
        </div>
        <div className="cml-col">
          <MinimapLab world={world} />
          <CvdStrip />
        </div>
      </div>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = CompassMinimapLab as typeof CompassMinimapLab & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
