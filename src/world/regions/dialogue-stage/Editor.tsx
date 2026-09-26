/**
 * Dialogue Stage — the script desk. Edits the scene's three blocks
 * (offer / accept / complete) plus an optional flag-setting choice, imports
 * shipped mission dialogue for surgery, and exports a paste-ready
 * "dialogue" block matching the mission schema in .ralph/ROUTES.md.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOCKS,
  CAST,
  FACTION_ORDER,
  exportDialogue,
  IMPORTABLES,
  lineLint,
  lineSeconds,
  scriptFromMission,
  wordCount,
  type BlockKey,
  type Script,
} from './data';

interface EditorProps {
  script: Script;
  onScript: (s: Script) => void;
  block: BlockKey;
  onBlock: (b: BlockKey) => void;
  wpm: number;
  activeLine: number;
  onActiveLine: (i: number) => void;
  importedFrom: string | null;
  onImportedFrom: (id: string | null) => void;
}

/** Auto-growing textarea that fits its text, capped at five rows. */
function GrowArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      className="ds-linetext"
      rows={1}
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props.label}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function Editor({ script, onScript, block, onBlock, wpm, activeLine, onActiveLine, importedFrom, onImportedFrom }: EditorProps) {
  const [copied, setCopied] = useState(false);
  const lines = script.blocks[block];
  const exported = useMemo(() => exportDialogue(script), [script]);
  const [importSel, setImportSel] = useState('');

  const patchBlock = (b: BlockKey, next: Script['blocks'][BlockKey]) =>
    onScript({ ...script, blocks: { ...script.blocks, [b]: next } });

  const patchLine = (i: number, p: Partial<(typeof lines)[number]>) =>
    patchBlock(block, lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    patchBlock(block, next);
    onActiveLine(j);
  };

  const addLine = () => {
    const who = lines.length ? lines[lines.length - 1].who : (CAST[0]?.character.id ?? 'ash-varga');
    patchBlock(block, [...lines, { who, text: '' }]);
    onActiveLine(lines.length);
  };

  const doImport = () => {
    const s = scriptFromMission(importSel);
    if (!s) return;
    onScript(s);
    onImportedFrom(importSel);
    onActiveLine(0);
    const first = BLOCKS.find((b) => s.blocks[b.id].length);
    if (first) onBlock(first.id);
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
    } catch {
      setCopied(false);
      const ta = document.getElementById('ds-export') as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand('copy');
      setCopied(true);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const c = script.choices;

  return (
    <section className="ds-desk" aria-label="Script desk">
      {/* ---- import row ---- */}
      <div className="ds-import panel">
        <label className="ds-import-label" htmlFor="ds-importsel">Steal a scene for surgery</label>
        <div className="ds-import-row">
          <select id="ds-importsel" value={importSel} onChange={(e) => setImportSel(e.target.value)}>
            <option value="">— {IMPORTABLES.length} shipped missions —</option>
            {IMPORTABLES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.chapter === 'side' ? 'side' : `ch${m.chapter}`} · {m.title} ({m.lines} lines{m.hasChoices ? ', choice' : ''})
              </option>
            ))}
          </select>
          <button className="btn" onClick={doImport} disabled={!importSel}>Import</button>
        </div>
        {importedFrom && (
          <p className="ds-import-note">
            Staged from <code>{importedFrom}</code> — edits live on this bench until you export.
            <button className="ds-linkbtn" onClick={() => onImportedFrom(null)}>clear reference</button>
          </p>
        )}
      </div>

      {/* ---- block tabs ---- */}
      <div className="ds-tabs" role="tablist" aria-label="Scene blocks">
        {BLOCKS.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={block === b.id}
            className={`ds-tab ${block === b.id ? 'on' : ''}`}
            onClick={() => { onBlock(b.id); onActiveLine(0); }}
            title={b.hint}
          >
            {b.label} <b>{script.blocks[b.id].length}</b>
          </button>
        ))}
        <button className="ds-tab ds-tab-add" onClick={addLine}>+ line</button>
      </div>

      {/* ---- lines ---- */}
      <ol className="ds-lines">
        {lines.length === 0 && (
          <li className="ds-emptyrow panel">
            The <strong>{block}</strong> beat is blank air. <button className="ds-linkbtn" onClick={addLine}>Write the first line</button>, pick a sample off the cast wall, or import a mission above.
          </li>
        )}
        {lines.map((l, i) => {
          const lints = lineLint(l);
          return (
            <li key={i} className={`ds-line panel ${i === activeLine ? 'active' : ''}`}>
              <div className="ds-line-head">
                <span className="ds-line-no">{i + 1}</span>
                <select
                  value={l.who}
                  aria-label={`Speaker for line ${i + 1}`}
                  className={lineLint(l).includes('unknown speaker') ? 'ds-bad' : ''}
                  onFocus={() => onActiveLine(i)}
                  onChange={(e) => patchLine(i, { who: e.target.value })}
                >
                  {![...CAST.map((cst) => cst.character.id)].includes(l.who) && <option value={l.who}>{l.who} (unknown)</option>}
                  {FACTION_ORDER.map((fid) => (
                    <optgroup key={fid} label={fid}>
                      {CAST.filter((cst) => cst.character.faction === fid).map((cst) => (
                        <option key={cst.character.id} value={cst.character.id}>{cst.character.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="ds-line-stats">
                  {wordCount(l.text)}w · {lineSeconds(l.text, wpm).toFixed(1)}s
                </span>
                <span className="ds-line-tools">
                  <button className="ds-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move line up">▲</button>
                  <button className="ds-mini" onClick={() => move(i, 1)} disabled={i === lines.length - 1} aria-label="Move line down">▼</button>
                  <button className="ds-mini danger" onClick={() => { patchBlock(block, lines.filter((_, j) => j !== i)); }} aria-label="Delete line">✕</button>
                </span>
              </div>
              <GrowArea
                value={l.text}
                label={`Text of line ${i + 1}`}
                placeholder="“…write the line…”"
                onChange={(v) => { onActiveLine(i); patchLine(i, { text: v }); }}
              />
              {lints.length > 0 && (
                <div className="ds-line-lints">
                  {lints.map((msg) => <span key={msg} className="ds-lintchip">⚠ {msg}</span>)}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* ---- choices ---- */}
      <div className="ds-choices panel">
        <div className="ds-choices-head">
          <label className="ds-choices-toggle">
            <input
              type="checkbox"
              checked={script.choicesOn}
              onChange={(e) => onScript({ ...script, choicesOn: e.target.checked })}
            />
            End the scene on a choice
          </label>
          <span className="dim">flags are dotted lowercase, e.g. <code>offer.choir</code></span>
        </div>
        {script.choicesOn && (
          <>
            <input
              className="ds-promptin"
              value={c.prompt}
              placeholder="Choice prompt — the teal line above the buttons"
              aria-label="Choice prompt"
              onChange={(e) => onScript({ ...script, choices: { ...c, prompt: e.target.value } })}
            />
            {c.options.map((o, i) => (
              <div className="ds-opt" key={i}>
                <input
                  className="ds-opttext"
                  value={o.text}
                  placeholder="Option text — what Ash says / does"
                  aria-label={`Option ${i + 1} text`}
                  onChange={(e) => onScript({ ...script, choices: { ...c, options: c.options.map((oo, j) => (j === i ? { ...oo, text: e.target.value } : oo)) } })}
                />
                <input
                  className="ds-optflag"
                  value={o.setsFlag}
                  placeholder="sets.flag"
                  aria-label={`Option ${i + 1} flag`}
                  onChange={(e) => onScript({ ...script, choices: { ...c, options: c.options.map((oo, j) => (j === i ? { ...oo, setsFlag: e.target.value } : oo)) } })}
                />
                <button className="ds-mini danger" aria-label="Remove option" disabled={c.options.length <= 1}
                  onClick={() => onScript({ ...script, choices: { ...c, options: c.options.filter((_, j) => j !== i) } })}>✕</button>
              </div>
            ))}
            <button className="ds-linkbtn" onClick={() => onScript({ ...script, choices: { ...c, options: [...c.options, { text: '', setsFlag: '' }] } })}>
              + another option
            </button>
          </>
        )}
      </div>

      {/* ---- export ---- */}
      <div className="ds-export panel">
        <div className="ds-export-head">
          <h4>Paste-ready block</h4>
          <button className="btn primary" onClick={copyExport}>{copied ? 'Copied ✓' : 'Copy JSON'}</button>
        </div>
        <p className="dim">Drops into a mission file under <code>src/content/missions/&lt;id&gt;.json</code> — the schema validator will know what to do.</p>
        <textarea id="ds-export" className="ds-exportcode" readOnly value={exported} spellCheck={false} aria-label="Exported dialogue JSON" />
      </div>
    </section>
  );
}
