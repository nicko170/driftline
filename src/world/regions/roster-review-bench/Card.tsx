/**
 * Roster card — one character rendered as its true in-game dialogue card:
 * portrait (or initials fallback) at the game's 64px framing, name + faction
 * chip in the game's own classes, role, and one line per core bucket shuffled
 * on the shared tick. Audited cards redraw as dashed ghost frames with a ▯
 * signal-not-recovered marker — shape carries the warning, never colour alone.
 */
import { withBase } from '../../../lib/base';
import {
  auditEntry,
  CORE_BUCKETS,
  lineForTick,
  PAINT_LABEL,
  type PaintState,
  type RosterEntry,
} from './data';

interface CardProps {
  entry: RosterEntry;
  tick: number;
  paint: PaintState;
  selected: boolean;
  onSelect: (id: string) => void;
  onImgOk: (id: string) => void;
  onImgFail: (id: string) => void;
}

export function Card({ entry, tick, paint, selected, onSelect, onImgOk, onImgFail }: CardProps) {
  const c = entry.character;
  const audit = auditEntry(entry, paint);
  const showImg = paint === 'painted' && entry.declaredArt;

  return (
    <button
      className={`rrb-card ${audit.flagged ? 'rrb-card-flagged' : ''} ${selected ? 'on' : ''}`}
      style={{ ['--fc' as string]: entry.faction.color }}
      onClick={() => onSelect(c.id)}
      aria-label={`Review ${c.name}, ${c.role}, ${entry.faction.name}. ${entry.totalLines} lines across ${CORE_BUCKETS.length + entry.extraBuckets.length} buckets. ${
        audit.flagged ? 'Flagged: ' + audit.reasons.join('; ') + '.' : 'No issues.'
      }`}
      aria-pressed={selected}
    >
      <span className="rrb-card-head">
        <span className="dialogue-portrait rrb-portrait">
          {showImg ? (
            <img
              src={withBase(entry.declaredArt!)}
              alt=""
              loading="lazy"
              onLoad={() => onImgOk(c.id)}
              onError={() => onImgFail(c.id)}
            />
          ) : (
            <span className="dialogue-initials" aria-hidden="true">
              {c.name
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </span>
          )}
          <span className={`rrb-stamp rrb-stamp-${paint}`}>{PAINT_LABEL[paint]}</span>
        </span>
        <span className="rrb-plate">
          <span className="dialogue-name rrb-name">{c.name}</span>
          <span className={`dialogue-faction faction-${c.faction}`}>{c.faction}</span>
          <span className="rrb-role">{c.role}</span>
          <span className="rrb-meta">
            <i aria-hidden="true">{entry.faction.glyph}</i> {entry.faction.name} ·{' '}
            <strong>{entry.totalLines}</strong> lines
          </span>
        </span>
      </span>

      <span className="rrb-lines" aria-hidden="true">
        {CORE_BUCKETS.map((b) => {
          const line = lineForTick(entry, b.id, tick);
          return line ? (
            <span key={b.id} className="rrb-line" title={b.hint}>
              <span className="rrb-line-tag">{b.label}</span>
              <span className="rrb-line-text">“{line}”</span>
            </span>
          ) : (
            <span key={b.id} className="rrb-line rrb-line-miss">
              <span className="rrb-line-tag">{b.label}</span>
              <span className="rrb-line-ghost">▯ no {b.label.toLowerCase()} bucket</span>
            </span>
          );
        })}
      </span>

      <span className="rrb-card-foot">
        {audit.flagged ? (
          <span className="rrb-flag" title={audit.reasons.join(' · ')}>
            ▯ signal not recovered — {audit.reasons[0]}
            {audit.reasons.length > 1 ? ` (+${audit.reasons.length - 1})` : ''}
          </span>
        ) : (
          <span className="rrb-ok">✓ sheet reads clean</span>
        )}
        {entry.extraBuckets.length > 0 && (
          <span className="rrb-extra">+{entry.extraBuckets.length} extra bucket{entry.extraBuckets.length === 1 ? '' : 's'}</span>
        )}
      </span>
    </button>
  );
}
