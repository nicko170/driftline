/**
 * STORM FRONT SANDBOX — the wall-of-sand tuning bench.
 *
 * A rolling storm front (curved fog shells + churning particle sheet) hunts a
 * simple hover-bike across a dusk pan. Sliders for wall speed, rubber-banding,
 * radius, height, density, turbulence; ride it with WASD and try to make the
 * shelter arch. Purpose: tune the ch3/ch5 storm missions — "Copy JSON" emits
 * constants that drop straight into src/game/MissionDirector.tsx.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [5800, 5400],
 * radius 4) and the default export carries `meta`/`anchors` statics — the
 * game streams nothing from it.
 */
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { lab, releaseStorm } from './state';
import { SandboxScene } from './Scene';
import { StormWall, WindStreaks } from './Storm';
import { Bike } from './Bike';
import { SandboxHud } from './Hud';
import { SandboxPanel } from './Panel';
import './panel.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function StormFrontSandbox() {
  // auto-release the wall shortly after mount + global hotkeys (C camera, R wall)
  useEffect(() => {
    const t = window.setTimeout(() => releaseStorm(), 1400);
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'c') lab.camMode = lab.camMode === 'chase' ? 'wide' : 'chase';
      else if (k === 'r') releaseStorm();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="sfs-root">
      <div className="sfs-canvas">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 7, -78], fov: 60, near: 0.5, far: 3200 }}
          gl={{ antialias: true }}
        >
          <SandboxScene />
          <Bike />
          <StormWall />
          <WindStreaks />
        </Canvas>
      </div>
      <SandboxHud />
      <SandboxPanel />
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = StormFrontSandbox as typeof StormFrontSandbox & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
