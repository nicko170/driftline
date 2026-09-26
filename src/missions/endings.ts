/**
 * Epilogues — the two endings of Chapter 5. A mission or dialogue choice sets
 * `ending.rain` or `ending.quiet`; the title screen and credits read these.
 */

export interface Epilogue {
  id: 'rain' | 'quiet';
  flag: string;
  title: string;
  kicker: string;
  text: string;
  coda: string;
}

export const EPILOGUES: Epilogue[] = [
  {
    id: 'rain',
    flag: 'ending.rain',
    title: 'The Rain Ending',
    kicker: 'LAST DELIVERY — MADE',
    text:
      'You set the key in the door at Mothersgate, and MOTHER woke the way she always meant to — ' +
      'gently, in someone’s hands. The glass is blooming back to soil. Somewhere out past Windspine ' +
      'the first honest rain in two hundred years is learning the way down, and the desert is ' +
      'learning what to do with it.',
    coda: 'The salt remembers every track. Yours lead somewhere green now. You can keep riding — the doors stay open.',
  },
  {
    id: 'quiet',
    flag: 'ending.quiet',
    title: 'The Quiet Ending',
    kicker: 'LAST DELIVERY — MADE',
    text:
      'You read the warrant twice, signed nothing, and let her sleep. The door at Mothersgate closed ' +
      'without complaint. The hard free life goes on: salt, storms, the hum of a good bike, the ' +
      'long radio dark between towns. Some deliveries you make by not making them.',
    coda: 'The desert keeps its own counsel, and so do you. You can keep riding — the doors stay open.',
  },
];

export function endingFor(flags: string[]): Epilogue | null {
  return EPILOGUES.find((e) => flags.includes(e.flag)) ?? null;
}
