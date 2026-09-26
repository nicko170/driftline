/**
 * Audience strip + flag-integrity audit.
 *
 * The strip shows what each ending retro-unlocks the moment its flag lands:
 * achievements (live-probed against the shipped predicates) and missions
 * gated behind the flag (a hook reserved for post-game content — empty until
 * writers wire it). The audit statically scans every mission JSON and choice
 * tree so “both endings from one run” is impossible to ship quietly.
 */
import { useMemo } from 'react';
import { useSaveStore } from '../../../state/store';
import {
  ENDING_GLYPH,
  EPILOGUES,
  gatedByEnding,
  probeEndingUnlocks,
  runIntegrityAudit,
  type Check,
} from './data';

const LEVEL_GLYPH: Record<Check['level'], string> = { pass: '✓', warn: '⚠', err: '✕' };

export function Audience() {
  // re-probe live when flags/achievements change
  const flags = useSaveStore((s) => s.flags);
  const achievements = useSaveStore((s) => s.achievements);
  const byEnding = useMemo(
    () =>
      EPILOGUES.map((ep) => ({
        ep,
        unlocks: probeEndingUnlocks(ep.flag),
        gated: gatedByEnding(ep.flag),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flags, achievements],
  );

  return (
    <div className="ecr-audience">
      {byEnding.map(({ ep, unlocks, gated }) => (
        <section key={ep.id} className={`ecr-aud-col panel ecr-${ep.id}`}>
          <h3>
            <span className="ecr-glyph" aria-hidden="true">{ENDING_GLYPH[ep.flag]}</span> {ep.title} — what the flag brings back
          </h3>

          <div className="ecr-aud-group">
            <p className="ecr-toollabel">Achievements (live probe)</p>
            {unlocks.length === 0 && <p className="ecr-dim">No achievement fires on this flag — wire one in src/game/achievements.ts.</p>}
            {unlocks.map((u) => (
              <div key={u.id} className="ecr-unlock">
                <span className="ecr-unlock-icon" aria-hidden="true">{u.icon}</span>
                <span className="ecr-unlock-body">
                  <strong>{u.title}</strong>
                  <span className="ecr-dim">{u.desc}</span>
                </span>
                <span className={`ecr-unlock-state ${u.live ? 'live' : ''}`}>{u.live ? '● in save' : u.hidden ? 'hidden def' : 'dormant'}</span>
              </div>
            ))}
          </div>

          <div className="ecr-aud-group">
            <p className="ecr-toollabel">Content gated behind {ep.flag}</p>
            {gated.length === 0 ? (
              <p className="ecr-dim">
                None yet — the hook is reserved. A mission with <code>requires.flags: [&quot;{ep.flag}&quot;]</code> would appear here the moment it ships.
              </p>
            ) : (
              gated.map((g) => (
                <div key={g.id} className="ecr-unlock">
                  <span className="ecr-unlock-icon" aria-hidden="true">◆</span>
                  <span className="ecr-unlock-body">
                    <strong>{g.title}</strong>
                    <span className="ecr-dim">{g.id} · chapter {g.chapter}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="ecr-aud-group">
            <p className="ecr-toollabel">Codex</p>
            <p className="ecr-dim">
              Entries unlock only via <code>lore:&lt;slug&gt;</code> flags or signal caches (see ROUTES.md) — endings grant none directly. Post-game lore tied to a future would travel through the gated-mission hook above.
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}

export function Audit() {
  const { touches, checks } = useMemo(runIntegrityAudit, []);
  const errs = checks.filter((c) => c.level === 'err').length;
  const warns = checks.filter((c) => c.level === 'warn').length;

  return (
    <div className="ecr-audit">
      <div className="ecr-audit-verdict panel" data-level={errs ? 'err' : warns ? 'warn' : 'pass'}>
        <span className="ecr-audit-glyph" aria-hidden="true">{errs ? '✕' : warns ? '⚠' : '✓'}</span>
        <div>
          <strong>{errs ? 'Integrity breach' : warns ? 'Flags intact, notes below' : 'Flag integrity holds'}</strong>
          <p className="ecr-dim">
            {touches.length} ending-flag touch{touches.length === 1 ? '' : 'es'} across the mission library · {checks.length} checks · {errs} err · {warns} warn
          </p>
        </div>
      </div>

      <ul className="ecr-checks">
        {checks.map((c) => (
          <li key={c.id} className={`ecr-check-row ${c.level}`}>
            <span className="ecr-check-glyph" aria-hidden="true">{LEVEL_GLYPH[c.level]}</span>
            <span className="ecr-check-body">
              <strong>{c.label}</strong>
              <span className="ecr-dim">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {touches.length > 0 && (
        <div className="ecr-touches panel">
          <p className="ecr-toollabel">Every ending-flag touch in shipped content</p>
          {touches.map((t, i) => (
            <div key={i} className="ecr-touch">
              <span className="ecr-glyph" aria-hidden="true">{ENDING_GLYPH[t.flag] ?? '◇'}</span>
              <code>{t.flag}</code>
              <span className={`ecr-touch-kind k-${t.kind === 'requires' ? 'req' : 'set'}`}>{t.kind}</span>
              <span>{t.title}</span>
              <span className="ecr-dim">{t.missionId} · ch {t.chapter} · {t.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
