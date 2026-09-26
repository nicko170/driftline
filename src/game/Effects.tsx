/**
 * Post-processing — only mounted on the "high" quality preset (see GameScreen).
 * Bloom makes emissives (lamps, engine glow, beacons) bloom at night; vignette
 * keeps focus centre-screen. SMAA is bundled by the composer.
 */
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={0.62} luminanceThreshold={0.72} luminanceSmoothing={0.24} />
      <Vignette darkness={0.34} offset={0.3} />
    </EffectComposer>
  );
}
