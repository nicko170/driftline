/**
 * ENDING CHOICE REHEARSAL — the Chapter V finale stage.
 *
 * A scrollable timeline mounting the shipped pieces of the Last Delivery
 * moment against a save snapshot: the real threshold dialogue (choices wired
 * straight into live flags), the shipped chapter-outro debrief card, and the
 * title-screen epilogue asides reading the store in real time. Two doors of
 * light pick the ending to rehearse; a broadcast-pace reader types the
 * epilogue over radio static; the audience strip live-probes retro-unlocks;
 * and a static audit proves no shipped content can set both endings.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry contract: meta.json + anchors.json describe a
 * harmless off-world bench (centre [8200, 7600]) and the default export
 * carries meta/anchors statics — the game streams nothing from it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../../lib/base';
import { useGameStore, useSaveStore, type RideMode } from '../../../state/store';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import DialogueBox from '../../../ui/DialogueBox';
import ChapterOutroCard from '../../../ui/ChapterOutroCard';
import { CHAPTERS } from '../../../missions/chapters';
import { missionsById } from '../../../missions/library';
import { audio } from '../../../audio/audio';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { ENDING_GLYPH, EPILOGUES, FINAL_MISSION_ID, finalChoiceAvailable, runIntegrityAudit } from './data';
import { Doors, type EndingId } from './Doors';
import { Reader } from './Reader';
import { Audience, Audit } from './Audit';
import { staticBed } from './static';
import './rehearsal.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

/** What we borrow from the real save while the stage is set. */
interface SaveSnap {
  flags: string[];
  chaptersSeen: number[];
  outrosSeen: number[];
  mode: RideMode;
}

function EndingChoiceRehearsal() {
  const flags = useSaveStore((s) => s.flags);
  const [pick, setPick] = useState<EndingId>('rain');
  const [keepInSave, setKeepInSave] = useState(false);
  const [staged, setStaged] = useState(false);

  const snapRef = useRef<SaveSnap | null>(null);
  const keepRef = useRef(keepInSave);
  keepRef.current = keepInSave;

  const finale = missionsById.get(FINAL_MISSION_ID);
  const auditor = useMemo(runIntegrityAudit, []);
  const errs = auditor.checks.filter((c) => c.level === 'err').length;
  const warns = auditor.checks.filter((c) => c.level === 'warn').length;

  const liveFlags = EPILOGUES.filter((e) => flags.includes(e.flag)).map((e) => e.flag);
  const bothLive = liveFlags.length > 1;

  /* ---------- snapshot guard: rehearse hard, leave no tracks ---------- */

  const takeSnapshot = () => {
    if (snapRef.current) return;
    const s = useSaveStore.getState();
    const g = useGameStore.getState();
    snapRef.current = { flags: [...s.flags], chaptersSeen: [...s.chaptersSeen], outrosSeen: [...s.outrosSeen], mode: g.mode };
    setStaged(true);
  };

  const restoreSnapshot = () => {
    const snap = snapRef.current;
    if (!snap) return;
    useSaveStore.setState({ flags: snap.flags, chaptersSeen: snap.chaptersSeen, outrosSeen: snap.outrosSeen });
    const g = useGameStore.getState();
    if (g.dialogue) g.closeDialogue();
    if (g.chapterOutro !== null) g.setChapterOutro(null);
    if (g.mode !== snap.mode) g.setMode(snap.mode);
    snapRef.current = null;
    setStaged(false);
  };

  useEffect(
    () => () => {
      staticBed.stop();
      // never leak an open rehearsal into the game
      const g = useGameStore.getState();
      if (g.dialogue) g.closeDialogue();
      if (g.chapterOutro !== null) g.setChapterOutro(null);
      if (!keepRef.current && snapRef.current) {
        const snap = snapRef.current;
        useSaveStore.setState({ flags: snap.flags, chaptersSeen: snap.chaptersSeen, outrosSeen: snap.outrosSeen });
        if (g.mode !== snap.mode) useGameStore.getState().setMode(snap.mode);
      }
    },
    [],
  );

  /* ---------- stage hands ---------- */

  const stageDialogue = () => {
    if (!finale?.dialogue?.choices?.length) return;
    takeSnapshot();
    audio.resume();
    const g = useGameStore.getState();
    if (g.chapterOutro !== null) g.setChapterOutro(null);
    g.openDialogue(finale.dialogue.complete, finale.dialogue.choices[0]);
  };

  const stageOutro = () => {
    takeSnapshot();
    audio.resume();
    const s = useSaveStore.getState();
    for (const c of CHAPTERS) s.markChapterSeen(c.n); // suppress intro-card gate
    const g = useGameStore.getState();
    if (g.dialogue) g.closeDialogue(); // also restores mode to riding
    g.setMode('riding');
    g.setChapterOutro(5);
  };

  const flipFlag = (flag: string, on: boolean) => {
    takeSnapshot();
    audio.resume();
    audio.blip(on ? 760 : 420, 0.07);
    if (on) useSaveStore.getState().setFlags([flag]);
    else useSaveStore.setState({ flags: useSaveStore.getState().flags.filter((f) => f !== flag) });
  };

  const resetStage = () => {
    audio.resume();
    restoreSnapshot();
    audio.blip(300, 0.09);
  };

  /* ---------- render ---------- */

  return (
    <div className="ecr-root">
      {/* shipped overlays that mount fixed: the debrief card lives up here */}
      <ChapterOutroCard />

      {/* ---------- marqee ---------- */}
      <header
        className="ecr-head"
        style={{ backgroundImage: `url(${withBase('images/work/ending-choice-rehearsal.jpg')})` }}
        role="img"
        aria-label="A violet night rehearsal stage on the salt: two tall doorways of light, one blooming teal, one calm amber, with a lone courier and hover-bike waiting between them"
      >
        <div className="ecr-head-veil">
          <p className="ecr-kicker">WORKSHED · CHAPTER V · THE LAST DELIVERY</p>
          <h2>Ending Choice Rehearsal</h2>
          <p>
            One choice, two futures. This stage mounts the shipped threshold scene, the debrief card
            and the title-screen epilogues against the live save — rehearse both futures, read the
            drafts out loud over band nine, and prove in static that no mission can sign both doors.
          </p>
        </div>
        <div className="ecr-tally" aria-label="Stage tally">
          <span><strong>{liveFlags.length}</strong> ending flag{liveFlags.length === 1 ? '' : 's'} live</span>
          <span><strong>{auditor.touches.length}</strong> flag touches</span>
          {errs > 0 && <span className="ecr-flag err"><strong>{errs}</strong> integrity err</span>}
          {warns > 0 && <span className="ecr-flag warn"><strong>{warns}</strong> warn</span>}
          {errs + warns === 0 && <span className="ecr-clean">✓ integrity holds</span>}
        </div>
      </header>

      {/* ---------- flag console + snapshot guard rail ---------- */}
      <div className="ecr-console panel" role="group" aria-label="Flag console">
        <span className="ecr-toollabel">Flag console</span>
        {EPILOGUES.map((ep) => {
          const on = flags.includes(ep.flag);
          return (
            <span key={ep.id} className={`ecr-fchip ${on ? 'on' : ''}`}>
              <span className="ecr-glyph" aria-hidden="true">{ENDING_GLYPH[ep.flag]}</span>
              <code>{ep.flag}</code>
              <button
                className="ecr-fbtn"
                aria-pressed={on}
                onClick={() => flipFlag(ep.flag, !on)}
              >
                {on ? '● set — clear' : '○ dark — set'}
              </button>
            </span>
          );
        })}
        <label className="ecr-ctl ecr-check ecr-keep">
          <input type="checkbox" checked={keepInSave} onChange={(e) => setKeepInSave(e.target.checked)} />
          keep staged flags in my save when I leave
        </label>
        {staged && (
          <button className="btn ecr-reset" onClick={resetStage}>
            ⟲ Strike the set — restore snapshot
          </button>
        )}
        {bothLive && (
          <span className="ecr-flag err ecr-both">
            ✕ both endings live — impossible from shipped content (see the audit); the title screen resolves rain first
          </span>
        )}
      </div>

      {/* ---------- REEL 01 · the doors ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 01</span> The doors of light</h3>
        <p className="ecr-reel-note">
          Pick which future tonight’s rehearsal plays. Shape first — <span className="ecr-glyph">⟡</span> the
          record glyph blooms teal, <span className="ecr-glyph">◉</span> the broadcast glyph rests amber; colour
          only decorates what the shape already says.
        </p>
        <Doors pick={pick} onPick={setPick} />
      </section>

      {/* ---------- REEL 02 · the threshold scene ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 02</span> The threshold scene — shipped dialogue box</h3>
        <p className="ecr-reel-note">
          The real <code>{FINAL_MISSION_ID}</code> completion scene, mounted in the shipped dialogue box
          with its choice wired to the live save. Click through the lines; the two options are the two
          endings, verbatim. Staging takes a snapshot first — strike the set to undo.
        </p>
        <div className="ecr-stage">
          <div className="ecr-stage-floor" aria-hidden="true" />
          {finalChoiceAvailable() ? (
            <>
              <DialogueBox />
              <div className="ecr-stage-actions">
                <button className="btn primary" onClick={stageDialogue}>
                  ▸ Stage the scene at the {ENDING_GLYPH[EPILOGUES.find((e) => e.id === pick)?.flag ?? '']} door
                </button>
                <span className="ecr-dim">advance with E / Enter / Space or by clicking the box</span>
              </div>
            </>
          ) : (
            <p className="ecr-dim ecr-missing">
              The finale mission <code>{FINAL_MISSION_ID}</code> (or its choice) is not in content yet — when
              a writer ships it, this stage lights automatically.
            </p>
          )}
        </div>
      </section>

      {/* ---------- REEL 03 · the debrief ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 03</span> The debrief — shipped chapter-outro card</h3>
        <p className="ecr-reel-note">
          The real outro card for Chapter V, mounted fullscreen exactly as it lands in play (amber kicker,
          salt title, ◆◆◆ rule). It also rehearses the gating: the intro-card hold is satisfied by
          snapshotting <code>chaptersSeen</code>, and dismissing restores via the same rail.
        </p>
        <div className="ecr-reel-actions">
          <button className="btn primary" onClick={stageOutro}>
            ✦ Raise the Chapter V debrief card
          </button>
          <span className="ecr-dim">dismiss with E / Enter / Esc — the card eats those edges, as shipped</span>
        </div>
      </section>

      {/* ---------- REEL 04 · the epilogues ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 04</span> The epilogues — title-screen panels, live</h3>
        <p className="ecr-reel-note">
          The exact asides the title screen renders, driven by the live save flags: the moment a flag is
          set — by the console above or by the choice itself — its panel lights. The other stays dark,
          the way a save that never chose it stays dark.
        </p>
        <div className="ecr-epilogues">
          {EPILOGUES.map((ep) => {
            const on = flags.includes(ep.flag);
            return (
              <aside
                key={ep.id}
                className={`title-epilogue panel ecr-epi ecr-epi-${ep.id} ${on ? 'live' : 'dark'}`}
                aria-label={`${ep.title} epilogue panel — ${on ? 'live on the title screen' : 'dark'}`}
              >
                <span className="title-epilogue-kicker">{ep.kicker}</span>
                <strong className="title-epilogue-title">
                  <span className="ecr-glyph" aria-hidden="true">{ENDING_GLYPH[ep.flag]}</span> {ep.title}
                </strong>
                <p>{ep.text}</p>
                <p className="dim">{ep.coda}</p>
                <span className={`ecr-epi-state ${on ? 'on' : ''}`}>{on ? '● on the title screen now' : '○ dark — flag not in save'}</span>
              </aside>
            );
          })}
        </div>
        <Reader pick={pick} />
      </section>

      {/* ---------- REEL 05 · the audience ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 05</span> The audience — what a flag brings back</h3>
        <p className="ecr-reel-note">
          Achievements are live-probed against the shipped predicates (save minus flag vs save plus flag),
          so new wiring lights up here without a line of bench code. Ending-gated missions are the
          post-game hook — empty until a writer parks content behind a future.
        </p>
        <Audience />
      </section>

      {/* ---------- REEL 06 · the audit ---------- */}
      <section className="ecr-reel">
        <h3 className="ecr-reel-title"><span>REEL 06</span> Flag integrity — the static audit</h3>
        <p className="ecr-reel-note">
          A scan of every mission JSON and dialogue choice tree. Five ways endings go wrong, checked
          against shipped content every time this stage opens.
        </p>
        <Audit />
      </section>

      <footer className="ecr-foot">
        <p>
          House rules the stage enforces: endings are set by <em>chapter 5 content only</em>; one mission
          signs one future; a choice may offer both futures but never the same one twice; nothing may be
          gated behind the flag it sets. Strike the set before you leave unless you mean to ride home in
          the future you rehearsed.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = EndingChoiceRehearsal as typeof EndingChoiceRehearsal & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
