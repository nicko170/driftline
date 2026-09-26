/**
 * The two doors of light. Pure DOM art under CSS keyframes:
 * the teal door blooms (rising spores, ⟡ record glyph) — the amber door
 * rests (drifting motes, ◉ broadcast glyph). Shape first; colour decorates.
 */
import { EPILOGUES, ENDING_GLYPH } from './data';

export type EndingId = 'rain' | 'quiet';

const SPORES = [12, 34, 57, 71, 88]; // left % stagger for the teal door's rising motes
const MOTES = [8, 26, 45, 63, 79, 92];

export function Doors({
  pick,
  onPick,
}: {
  pick: EndingId;
  onPick: (id: EndingId) => void;
}) {
  return (
    <div className="ecr-doors" role="radiogroup" aria-label="Choose which ending to rehearse">
      {EPILOGUES.map((ep) => {
        const id = ep.id as EndingId;
        const on = pick === id;
        const glyph = ENDING_GLYPH[ep.flag];
        return (
          <button
            key={id}
            className={`ecr-door ecr-door-${id} ${on ? 'on' : ''}`}
            onClick={() => onPick(id)}
            role="radio"
            aria-checked={on}
            aria-label={`${ep.title} — rehearse this ending`}
          >
            <span className="ecr-door-arch" aria-hidden="true">
              {id === 'rain'
                ? SPORES.map((l, i) => <i key={i} className="ecr-spore" style={{ left: `${l}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${5.2 + (i % 3) * 1.3}s` }} />)
                : MOTES.map((l, i) => <i key={i} className="ecr-mote" style={{ left: `${l}%`, animationDelay: `${i * 1.2}s`, animationDuration: `${7 + (i % 4) * 1.6}s` }} />)}
              <span className="ecr-door-glyph">{glyph}</span>
            </span>
            <span className="ecr-door-label">
              <span className="ecr-door-glyph-inline">{glyph}</span> {ep.title}
            </span>
            <span className="ecr-door-sub">
              {id === 'rain' ? 'wake her — the bloom, the first honest rain' : 'let her sleep — the hard free life rides on'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
