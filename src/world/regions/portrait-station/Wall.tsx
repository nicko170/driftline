/**
 * Wall — the pegboard. Every character of the Driftline hangs here as a
 * polaroid on a string, badge showing the QC grade once the film develops
 * (shape + colour, never colour alone). Click a frame to wheel it under the
 * grading lamp (the Booth).
 */
import { memo } from 'react';
import { withBase } from '../../../lib/base';
import type { Character } from '../../../dialogue/library';
import { overall, type Check, type WallEntry } from './data';

export type CardState = 'developing' | 'awaiting' | 'missing-frame' | 'graded';

export function cardState(entry: WallEntry, analysed: boolean, hasChecks: boolean): CardState {
  if (!entry.declaredArt) return 'awaiting';
  if (!analysed) return 'developing';
  return hasChecks ? 'graded' : 'missing-frame';
}

const GRADE_STYLE: Record<string, string> = { A: 'g-a', B: 'g-b', C: 'g-c', R: 'g-r' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export interface WallProps {
  entries: WallEntry[];
  checksById: Map<string, Check[]>;
  analysed: Set<string>;
  selected: string | null;
  onSelect: (c: Character) => void;
}

export const Wall = memo(function Wall({ entries, checksById, analysed, selected, onSelect }: WallProps) {
  return (
    <div className="ps-wall panel" role="list" aria-label="Portrait wall">
      {entries.map((e) => {
        const c = e.character;
        const checks = checksById.get(c.id);
        const state = cardState(e, analysed.has(c.id), Boolean(checks));
        const grade = checks ? overall(checks) : null;
        const alt =
          (c as { heroAlt?: string }).heroAlt ?? `Illustrated portrait of ${c.name}, ${c.role}`;
        return (
          <button
            key={c.id}
            role="listitem"
            className={[
              'ps-card',
              state === 'awaiting' && 'is-awaiting',
              state === 'developing' && 'is-developing',
              state === 'missing-frame' && 'is-missing',
              grade && GRADE_STYLE[grade.letter],
              selected === c.id && 'is-selected',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(c)}
            aria-pressed={selected === c.id}
            aria-label={`${c.name} — ${c.role}. ${
              state === 'awaiting'
                ? 'Awaiting sitting.'
                : state === 'developing'
                  ? 'Film developing.'
                  : state === 'missing-frame'
                    ? 'Declared art not found on the wall.'
                    : `Graded ${grade?.label}.`
            }`}
          >
            <span className="ps-pin" style={{ color: e.faction.color }} aria-hidden="true">
              {e.faction.glyph}
            </span>
            <span className="ps-frame">
              {e.declaredArt ? (
                <img src={withBase(e.declaredArt)} alt="" loading="lazy" draggable={false} />
              ) : (
                <span className="ps-initials" aria-hidden="true">{initials(c.name)}</span>
              )}
            </span>
            <span className="ps-cap">
              <strong>{c.name}</strong>
              <span>{c.role}</span>
            </span>
            <span className="ps-badge" aria-hidden="true">
              {state === 'graded' && grade ? (
                <>
                  <i>{grade.glyph}</i> {grade.letter}
                </>
              ) : state === 'awaiting' ? (
                <><i>◌</i> —</>
              ) : state === 'missing-frame' ? (
                <><i>✕</i> 404</>
              ) : (
                <><i>◌</i> ··</>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
