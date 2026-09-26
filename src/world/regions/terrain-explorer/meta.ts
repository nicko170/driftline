/**
 * Heightfield Explorer — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab-style cards.
 */
export const meta = {
  title: 'Heightfield Explorer',
  description:
    'Worldgen debugging, but pretty: a fly-through of the shared DRIFTLINE heightfield in false colour — height bands, surface-grip tint, region masks and route ribbons — with toggles that peel each terrain feature (Glassroad carve, Windspine ridge, Skydock mesa, salt flats, boundary wall) and a seed shifter that previews alternate dunes. The replica is verified against the live terrainHeight() at load (Δ ~3 µm, float-cache exact) and badged in the panel.',
  blurb:
    'Fly the world heightfield in false colour: height bands, surface grip, region masks, per-feature layer toggles and seed previews — verified against live worldgen (Δ ~3 µm).',
  tags: ['tool', 'worldgen', 'terrain', 'r3f'],
  client: 'Driftline worldgen',
  caseStudy:
    'The game derives bike physics, vertex colours and scatter from one analytic heightfield (src/lib/terrain.ts). This bench caches each feature into its own Float32Array so toggles recombine in ~10 ms; a Δ badge proves the cached replica matches the shipped function to float-cache precision (~3 µm), so the debug view can never silently drift from the world the game plays on.',
};

export default meta;
