/**
 * Boost Feedback Lab — demo meta. Follows the demo sheet format
 * ({ title, description, tags, client, caseStudy }); `blurb` feeds lab cards.
 */
export const meta = {
  title: 'Boost Feedback Lab',
  description:
    'A feel bench for the three sweetest seconds in the game: synthetic bike telemetry rides a treadmill speed strip while candidate boost feedbacks — camera FOV curves (shipped kick, punch-in, speed-blend, elbow ease), boost shake treatments, engine pitch mappings and boost-bar drain styles — audition live against the shipped treatment. A scripted 9 s tape gives fair A/B; a strobe alternates shipped ↔ candidate every 2.2 s; a chart plots every curve over the tape. Exports the chosen preset as JSON.',
  blurb:
    'Audition boost feedback against the shipped treatment on a treadmill speed strip — FOV curves, camera shake, engine pitch, boost-bar styles. Scripted tape + strobe for fair A/B, chart for proof.',
  tags: ['tool', 'feel', 'camera', 'audio', 'r3f'],
  client: 'Driftline game feel',
  caseStudy:
    'The shipped boost feedback is a binary step (CameraRig.tsx ×1.25 FOV, audio.ts +26 Hz, no shake). Hard to argue against without alternatives. This bench separates the question into four channels, drives them all from one synthetic feel model (stock Bike.tsx constants, asymptotic speed), and makes an identical scripted run replayable — so “which reads better” stops being a vibes argument and becomes a two-second strobe.',
};

export default meta;
