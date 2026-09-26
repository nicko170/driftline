/**
 * Codex Reader Lab — the reading pane. Renders one lore entry in three
 * "sheets": the tuned night sheet (the codex dark panel, upgraded), day paper
 * (light page for the sunlit half of the cycle), and the decorative printed
 * Guild form. The baseline variant renders exactly what CodexScreen ships
 * today, so the compare view is an honest before/after.
 */
import type { CSSProperties } from 'react';
import type { LoreEntry } from '../../../codex/library';
import {
  BASELINE,
  categoryOf,
  formNumber,
  measureVerdict,
  readMinutes,
  renderBaselineBody,
  renderTunedBody,
  type ReaderSettings,
} from './data';

function docStyle(s: ReaderSettings): CSSProperties {
  return {
    fontSize: `${s.size}px`,
    lineHeight: s.leading,
    maxWidth: `${s.measure}ch`,
    letterSpacing: `${(s.tracking / 100).toFixed(2)}em`,
    fontFamily:
      s.font === 'serif'
        ? 'ui-serif, Georgia, "Times New Roman", serif'
        : "'Sora', ui-sans-serif, system-ui, sans-serif",
  };
}

function DocHead({ entry }: { entry: LoreEntry }) {
  const cat = categoryOf(entry);
  return (
    <header className="crl-doc-head">
      <p className="crl-doc-cat">
        <i aria-hidden="true" style={{ color: cat.color }}>
          {cat.glyph}
        </i>{' '}
        {cat.label}
      </p>
      <h3 className="crl-doc-title">{entry.title}</h3>
      {entry.summary && <p className="crl-doc-summary">{entry.summary}</p>}
    </header>
  );
}

/** The guild-form dressing: form number, ledger rules, stamp, filing block. */
function FormDressing({ entry, children }: { entry: LoreEntry; children: React.ReactNode }) {
  return (
    <div className="crl-form">
      <div className="crl-form-top">
        <span>SALT GUILD OF KESSA-9</span>
        <span>LONG-FORM ARCHIVE</span>
        <span className="crl-form-no">FORM {formNumber(entry.slug)}</span>
      </div>
      <div className="crl-form-rule" aria-hidden="true" />
      <div className="crl-form-body">{children}</div>
      <div className="crl-form-stamp" aria-hidden="true">
        <span>
          RECEIVED
          <br />
          SALTMOUTH
          <br />
          EXCHANGE
        </span>
      </div>
      <div className="crl-form-foot">
        <span>Filed by: ______________</span>
        <span>Countersigned: ______________</span>
        <span>Fee paid (salt): ◇◇◇</span>
      </div>
    </div>
  );
}

export function Reader({
  entry,
  settings,
  variant,
}: {
  entry: LoreEntry;
  settings: ReaderSettings;
  variant: 'tuned' | 'baseline';
}) {
  const tuned = variant === 'tuned';
  const mode = tuned ? settings.mode : 'sheet';
  const style: CSSProperties = tuned
    ? docStyle(settings)
    : {
        fontSize: `${BASELINE.size}px`,
        lineHeight: BASELINE.leading,
        fontFamily: "'Sora', ui-sans-serif, system-ui, sans-serif",
      };

  const body = tuned
    ? renderTunedBody(entry.body, 't')
    : renderBaselineBody(entry.body, 'b');

  const doc = (
    <article
      className={`crl-doc crl-doc-${mode} ${tuned ? 'crl-doc-tuned' : 'crl-doc-baseline'}`}
      style={style}
      aria-label={`${variant === 'tuned' ? 'Tuned' : 'Current codex'} rendering of ${entry.title}`}
    >
      <DocHead entry={entry} />
      <div className="crl-doc-body">{body}</div>
      <footer className="crl-doc-foot">
        {entry.words} words · recovered from the static
      </footer>
    </article>
  );

  return (
    <section className="crl-pane">
      <p className="crl-pane-label">
        {tuned ? '◈ TUNED SHEET' : '◇ CURRENT CODEX (as shipped)'}
      </p>
      {tuned && mode === 'form' ? <FormDressing entry={entry}>{doc}</FormDressing> : doc}
      {tuned && <ReaderStats entry={entry} settings={settings} />}
    </section>
  );
}

function ReaderStats({ entry, settings }: { entry: LoreEntry; settings: ReaderSettings }) {
  const verdict = measureVerdict(settings.measure);
  const paras = entry.body.split(/\n\s*\n/).filter((b) => b.trim()).length;
  const linePx = settings.size * settings.leading;
  return (
    <dl className="crl-stats">
      <div>
        <dt>Words</dt>
        <dd>{entry.words}</dd>
      </div>
      <div>
        <dt>Sections</dt>
        <dd>{paras}</dd>
      </div>
      <div>
        <dt>Read time</dt>
        <dd>~{readMinutes(entry).toFixed(1)} min</dd>
      </div>
      <div>
        <dt>Line pitch</dt>
        <dd>{linePx.toFixed(1)}px</dd>
      </div>
      <div className={verdict.ok ? 'ok' : 'warn'}>
        <dt>Measure</dt>
        <dd>{verdict.label}</dd>
      </div>
    </dl>
  );
}
