/**
 * DIALOGUE STAGE — the writer's puppet theatre.
 *
 * Cast any voice from src/content/characters, write offer/accept/complete
 * beats (plus a flag-setting choice), and watch the scene play in a
 * pixel-honest copy of the in-game dialogue box at phone / handheld / wide
 * frame sizes against midday, dusk and night backdrops. Playback dwells on
 * each line at reading speed; a lint pass flags unknown speakers, blank or
 * sprawling lines, and flag-less choices; the exporter emits a paste-ready
 * "dialogue" block per .ralph/ROUTES.md. Any shipped mission can be
 * imported for surgery.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [7900, 7300])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import {
  BACKDROPS,
  BLOCKS,
  blockSeconds,
  FRAMES,
  lintScript,
  loadPrefs,
  loadScript,
  savePrefs,
  saveScript,
  starterScript,
  type BlockKey,
} from './data';
import { Cast } from './Cast';
import { Stage } from './Stage';
import { Editor } from './Editor';
import './dialogue-stage.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

function DialogueStage() {
  const [script, setScript] = useState(() => loadScript() ?? starterScript());
  const [prefs, setPrefs] = useState(loadPrefs);
  const [block, setBlock] = useState<BlockKey>('accept');
  const [lineIdx, setLineIdx] = useState(0);
  const [pinned, setPinned] = useState('tamsin-cho');
  const [importedFrom, setImportedFrom] = useState<string | null>(null);

  useEffect(() => saveScript(script), [script]);
  useEffect(() => savePrefs(prefs), [prefs]);

  const issues = useMemo(() => lintScript(script), [script]);
  const errs = issues.filter((i) => i.level === 'err').length;
  const warns = issues.length - errs;

  const lines = script.blocks[block];
  const total = BLOCKS.reduce((n, b) => n + script.blocks[b.id].length, 0);
  const blockTime = blockSeconds(lines, prefs.wpm);

  const stageLine = (who: string, text: string) => {
    const next = [...script.blocks[block], { who, text }];
    setScript({ ...script, blocks: { ...script.blocks, [block]: next } });
    setLineIdx(next.length - 1);
  };

  return (
    <div className="ds-root">
      <header
        className="ds-head"
        style={{ backgroundImage: `url(${withBase('images/work/dialogue-stage.jpg')})` }}
        role="img"
        aria-label="A desert puppet theatre on the salt flats, two courier figures trading lines under a violet night sky strung with amber lights"
      >
        <div className="ds-head-veil">
          <h2>Dialogue Stage</h2>
          <p>
            The writer’s puppet theatre: cast the voices, block the beats, play the scene
            in the real dialogue box, then copy the JSON and walk it to a mission file.
          </p>
        </div>
        <div className="ds-tally" aria-label="Scene lint tally">
          <span><strong>{total}</strong> lines staged</span>
          <span><strong>{blockTime.toFixed(0)}s</strong> {block} block</span>
          {errs > 0 && <span className="ds-flag"><strong>{errs}</strong> err</span>}
          {warns > 0 && <span className="ds-flag warn"><strong>{warns}</strong> warn</span>}
          {errs + warns === 0 && <span className="ds-clean">✓ clean run</span>}
        </div>
      </header>

      {/* stage controls */}
      <div className="ds-tools panel">
        <div className="ds-toolgroup" role="toolbar" aria-label="Frame size">
          <span className="ds-toollabel">Frame</span>
          {FRAMES.map((f) => (
            <button
              key={f.id}
              className={`ds-tchip ${prefs.frame === f.id ? 'on' : ''}`}
              onClick={() => setPrefs({ ...prefs, frame: f.id })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ds-toolgroup" role="toolbar" aria-label="Backdrop">
          <span className="ds-toollabel">Backdrop</span>
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              className={`ds-tchip ${prefs.backdrop === b.id ? 'on' : ''}`}
              onClick={() => setPrefs({ ...prefs, backdrop: b.id })}
              title={b.scene}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label className="ds-toolgroup ds-wpm">
          <span className="ds-toollabel">Read pace</span>
          <input
            type="range"
            min={120}
            max={320}
            step={10}
            value={prefs.wpm}
            aria-label="Reading speed, words per minute"
            onChange={(e) => setPrefs({ ...prefs, wpm: Number(e.target.value) })}
          />
          <span className="ds-wpm-val">{prefs.wpm} wpm</span>
        </label>
        {issues.length > 0 && (
          <details className="ds-issues">
            <summary>Script notes ({issues.length})</summary>
            <ul>
              {issues.map((i, n) => (
                <li key={n} className={i.level}>
                  <span className="ds-issues-where">{i.where}</span> {i.msg}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="ds-body">
        <Cast pinned={pinned} onPin={setPinned} onStageLine={stageLine} />

        <Stage
          script={script}
          block={lines}
          blockName={block}
          frame={prefs.frame}
          backdrop={prefs.backdrop}
          wpm={prefs.wpm}
          lineIdx={lineIdx}
          onLineIdx={setLineIdx}
        />

        <Editor
          script={script}
          onScript={setScript}
          block={block}
          onBlock={setBlock}
          wpm={prefs.wpm}
          activeLine={lineIdx}
          onActiveLine={setLineIdx}
          importedFrom={importedFrom}
          onImportedFrom={setImportedFrom}
        />
      </div>

      <footer className="ds-foot">
        <p>
          Writing rules the bench enforces: lines live in <code>offer</code>, <code>accept</code> and
          <code> complete</code>; a choice ends the scene and must set a dotted flag; spoken lines stay
          under ~280 characters — the desert has attention enough for exactly one speech per mission.
          Frames stand in for viewports, so <em>phone 390</em> is honest about thumbs.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = DialogueStage as typeof DialogueStage & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
