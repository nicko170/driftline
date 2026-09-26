/**
 * Traffic Planner — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Traffic Planner',
  description:
    'A surveyor\u2019s-table route editor for the ambient traffic fleet. The whole playable map of Kessa-9 is rendered on canvas2d as a relief survey sheet — hillshaded paper contours, teal glass canyon, rust hatch ridges — with every region circle and named anchor stamped from the same meta.json/anchors.json files the region registry streams. Plot new courier, hauler or skiff loops by clicking waypoints (they snap to anchors), drag them to retune, stamp the return leg home, then replay the fleet at real speed or 16\u00d7 to judge congestion: every vehicle gets a per-class silhouette dot that pulses amber when two pass within 55m, and any settlement no route serves gets a DEAD ZONE stamp. Readouts give loop length and lap time per class speed; the export button writes a ready-to-paste VEHICLES manifest in the exact VehicleSpec format that src/game/AmbientTraffic.tsx consumes, complete with anchor references in the trailing comments. A random-route stamp generates plausible seed traffic between distant anchors.',
  blurb:
    'Plot ambient courier loops on a surveyor\u2019s relief map of Kessa-9 — anchor snapping, lap-time maths, congestion replay — then export the exact VehicleSpec manifest AmbientTraffic consumes.',
  tags: ['tool', 'world', 'canvas2d', 'traffic', 'routes'],
  client: 'Driftline workshed',
  caseStudy:
    'AmbientTraffic shipped with six hand-typed polylines, and every world-life task since has hit the same wall: nobody can see the fleet. Are two routes crossing at the same moment? Is the drowned array a dead zone? How long is a Saltmouth\u21c4Mothersgate lap at hauler pace — and does the manifest even compile back into the game? The planner answers on one sheet: it reads the region registry\u2019s own meta/anchors JSON statically, draws the fleet the game ships as ghost reference traffic (mirrored verbatim, with a sync note), lets you draw, drag and snap new loops against real anchor positions, replays the whole table at up to 16\u00d7 with near-miss pulses and dead-zone stamps, and exports diff-clean VehicleSpec code. The route decision happens over the map, not over a diff.',
};

export default meta;
