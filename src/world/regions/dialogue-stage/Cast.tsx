/**
 * Dialogue Stage — the cast wall. Every character from the dialogue library,
 * with faction chips (glyph + colour, never colour alone), portrait status,
 * and a pinned voice card: role, bio, voice notes, and the character's four
 * line buckets with one-click "stage this line" samplers.
 */
import { useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import { CAST, FACTION_META, FACTION_ORDER, sampleLine } from './data';

const BUCKETS = ['greetings', 'barks', 'mission', 'radio'] as const;

interface CastProps {
  pinned: string;
  onPin: (id: string) => void;
  onStageLine: (who: string, text: string) => void;
}

export function Cast({ pinned, onPin, onStageLine }: CastProps) {
  const [faction, setFaction] = useState('all');
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CAST.filter((e) => {
      if (faction !== 'all' && e.character.faction !== faction) return false;
      if (!q) return true;
      const c = e.character;
      return `${c.name} ${c.role} ${c.id}`.toLowerCase().includes(q);
    });
  }, [faction, query]);

  const pin = CAST.find((e) => e.character.id === pinned)?.character ?? CAST[0]?.character;

  return (
    <aside className="ds-cast" aria-label="Cast wall">
      <h3 className="ds-cast-title">Cast wall <span className="dim">{CAST.length} voices</span></h3>

      <div className="ds-chips" role="toolbar" aria-label="Faction filters">
        <button className={`ds-fchip ${faction === 'all' ? 'on' : ''}`} onClick={() => setFaction('all')}>
          <i aria-hidden="true">◈</i> All
        </button>
        {FACTION_ORDER.map((fid) => {
          const meta = FACTION_META[fid];
          if (!meta) return null;
          return (
            <button
              key={fid}
              className={`ds-fchip ${faction === fid ? 'on' : ''}`}
              style={{ ['--fc' as string]: meta.color }}
              onClick={() => setFaction(faction === fid ? 'all' : fid)}
            >
              <i aria-hidden="true">{meta.glyph}</i> {meta.label}
            </button>
          );
        })}
      </div>

      <input
        className="ds-search"
        type="search"
        placeholder="Search the troupe…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search characters"
      />

      {pin && (
        <div className="ds-voicecard panel">
          <div className="ds-voicecard-head">
            <div className="ds-vc-portrait">
              {pin.portrait ? (
                <img src={withBase(pin.portrait)} alt={pin.name} />
              ) : (
                <span className="dialogue-initials">{pin.name.split(' ').map((w) => w[0]).join('')}</span>
              )}
            </div>
            <div>
              <div className="ds-vc-name">{pin.name}</div>
              <div className="ds-vc-role">{pin.role}</div>
              <span className={`dialogue-faction faction-${pin.faction}`}>{pin.faction}</span>
            </div>
          </div>
          <p className="ds-vc-voice"><em>Voice:</em> {pin.voice}</p>
          {BUCKETS.map((bucket) => {
            const lines = pin.lines?.[bucket];
            if (!lines?.length) return null;
            return (
              <div className="ds-vc-bucket" key={bucket}>
                <p className="ds-vc-bucket-label">{bucket} · {lines.length}</p>
                <div className="ds-vc-lines">
                  {lines.slice(0, 3).map((text, i) => (
                    <button
                      key={i}
                      className="ds-sample"
                      title="Stage this line in the current block"
                      onClick={() => onStageLine(pin.id, sampleLine(pin.id, bucket) ?? text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ul className="ds-castlist" aria-label="All characters">
        {entries.length === 0 && <li className="ds-emptyrow">No voice by that name. Check the casting office.</li>}
        {entries.map((e) => {
          const meta = FACTION_META[e.character.faction] ?? FACTION_META.independent;
          const active = e.character.id === pin?.id;
          return (
            <li key={e.character.id}>
              <button
                className={`ds-castrow ${active ? 'selected' : ''}`}
                onClick={() => onPin(e.character.id)}
                aria-current={active}
              >
                <span className="ds-cast-dot" style={{ ['--fc' as string]: meta.color }} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className="ds-cast-name">{e.character.name}</span>
                <span className="ds-cast-role">{e.lineCount} lines</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
