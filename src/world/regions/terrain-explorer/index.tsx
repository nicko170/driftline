/**
 * HEIGHTFIELD EXPLORER — worldgen debugging, but pretty.
 *
 * A fly-over of the shared DRIFTLINE heightfield (src/lib/terrain.ts) in
 * false colour: height bands with contours, the game-real surface-grip map,
 * or the shipped vertex palette — with toggles that peel each terrain feature
 * (canyon carve, Windspine ridge, Skydock mesa, salt flats…) and a seed
 * shifter that previews alternate dunes. The cached replica is checked
 * against the live terrainHeight() (Δ ~3 µm from f32 caching) and badged.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [6500, 5400])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { withBase } from '../../../lib/base';
import { ExplorerScene } from './Scene';
import { ExplorerPanel } from './Panel';
import { useExplorer } from './state';
import './terrain-explorer.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function TerrainExplorer() {
  // F toggles fly-cam from anywhere outside a form field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'KeyF') useExplorer.getState().toggle('fly');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="te-root">
      <div className="te-canvas">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [1250, 800, 2200], fov: 50, near: 1, far: 9000 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <ExplorerScene />
        </Canvas>
      </div>

      <header className="te-titlecard">
        <div
          className="te-art"
          style={{ backgroundImage: `url(${withBase('images/work/terrain-explorer.jpg')})` }}
          role="img"
          aria-label="Concept art of the Glass Desert heightfield in false colour"
        />
        <div>
          <h1>Heightfield Explorer</h1>
          <p>
            The world from the survey kite: peel worldgen layers, read the grip map, roll a seed.
            Verified against the shipped terrain.
          </p>
        </div>
      </header>

      <ExplorerPanel />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = TerrainExplorer as typeof TerrainExplorer & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
