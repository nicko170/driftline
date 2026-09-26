/**
 * PORTRAIT STATION — the character-art QC booth in Ketch's garage.
 *
 * Every painted portrait from src/content/characters hangs as a polaroid on
 * the pegboard wall. Each film develops through real canvas readback
 * (pixels.ts): warm-key luminance band, faction-palette drift, silhouette
 * readability, and the true 64px dialogue-card crop — graded, hung next to
 * its faction wall for context, run through the Vienot accessibility pass,
 * and, when it fails, turned into a corrective shot list for the paint tool.
 *
 * NOTE: this folder sits in the regions tree per workshed policy, so it also
 * satisfies the region registry/validator contract: `meta.json` +
 * `anchors.json` describe a harmless off-world bench (center [9600, 7000])
 * and the default export carries `meta`/`anchors` statics — the game streams
 * nothing from it.
 */
import { useEffect, useMemo, useState } from 'react';
import { withBase } from '../../../lib/base';
import type { Character } from '../../../dialogue/library';
import type { RegionMeta, Anchor, RegionModule } from '../../registry';
import regionMetaJson from './meta.json';
import anchorsJson from './anchors.json';
import { FACTION_ORDER, WALL, gradeAnalysis, overall, type WallEntry } from './data';
import { analyzePortrait, type PixelAnalysis } from './pixels';
import { Wall } from './Wall';
import { Booth } from './Booth';
import './portrait-station.css';

export { meta } from './meta';

const regionMeta = regionMetaJson as unknown as RegionMeta;
const regionAnchors = anchorsJson as unknown as Record<string, Anchor>;

type SortMode = 'name' | 'grade' | 'warmth';

function PortraitStation() {
  const [analyses, setAnalyses] = useState<Map<string, PixelAnalysis | null>>(new Map());
  const [selectedId, setSelectedId] = useState<string>('ash-varga');
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('name');

  /* develop every declared film, four baths at a time */
  useEffect(() => {
    let live = true;
    const queue = WALL.filter((e) => e.declaredArt);
    let active = 0;
    const pump = () => {
      while (active < 4 && queue.length) {
        const e = queue.shift()!;
        active++;
        void analyzePortrait(e.character.id, withBase(e.declaredArt!)).then((a) => {
          active--;
          if (live) setAnalyses((prev) => new Map(prev).set(e.character.id, a));
          pump();
        });
      }
    };
    pump();
    return () => {
      live = false;
    };
  }, []);

  const entriesById = useMemo(() => {
    const m = new Map<string, WallEntry>();
    for (const e of WALL) m.set(e.character.id, e);
    return m;
  }, []);

  /* grade sheets land as their films develop */
  const checksById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof gradeAnalysis>>();
    for (const e of WALL) {
      const a = analyses.get(e.character.id);
      if (a) m.set(e.character.id, gradeAnalysis(e.character, a));
    }
    return m;
  }, [analyses]);

  const visible = useMemo(() => {
    let list = WALL.filter((e) => factionFilter === 'all' || e.faction.id === factionFilter);
    if (sort === 'grade') {
      list = [...list].sort((a, b) => {
        const ga = checksById.get(a.character.id);
        const gb = checksById.get(b.character.id);
        return (gb ? overall(gb).score : -1) - (ga ? overall(ga).score : -1);
      });
    } else if (sort === 'warmth') {
      list = [...list].sort(
        (a, b) =>
          (analyses.get(b.character.id)?.warmShare ?? -1) - (analyses.get(a.character.id)?.warmShare ?? -1),
      );
    }
    return list;
  }, [factionFilter, sort, checksById, analyses]);

  /* header tally */
  const tally = useMemo(() => {
    const t = { painted: 0, developing: 0, awaiting: 0, missing: 0, gallery: 0, touch: 0, repaint: 0 };
    for (const e of WALL) {
      if (!e.declaredArt) { t.awaiting++; continue; }
      const a = analyses.get(e.character.id);
      if (a === undefined) { t.developing++; continue; }
      if (a === null) { t.missing++; continue; }
      t.painted++;
      const g = overall(gradeAnalysis(e.character, a)).letter;
      if (g === 'A' || g === 'B') t.gallery++;
      else if (g === 'C') t.touch++;
      else t.repaint++;
    }
    return t;
  }, [analyses]);

  const selected = entriesById.get(selectedId) ?? WALL[0];
  const selAnalysis = analyses.get(selected.character.id) ?? null;
  const selChecks = checksById.get(selected.character.id) ?? null;
  const selDeveloping = Boolean(selected.declaredArt) && !analyses.has(selected.character.id);

  const onSelect = (c: Character) => setSelectedId(c.id);

  return (
    <div className="ps-root">
      <header
        className="ps-head"
        style={{ backgroundImage: `url(${withBase('images/work/portrait-station.jpg')})` }}
        role="img"
        aria-label="Ketch's garage wall hung with small painted courier portraits on polaroid strings under amber festoon lights"
      >
        <div className="ps-head-veil">
          <h2>Portrait Station</h2>
          <p>
            The casting office’s grading lamp: every painted face on the pegboard, measured against
            the warm key, its faction chip, and the 64px box it will actually live in.
          </p>
        </div>
        <div className="ps-tally" aria-label="Wall tally">
          <span><strong>{tally.painted}</strong> painted</span>
          <span><strong>{tally.gallery}</strong> ● gallery</span>
          <span><strong>{tally.touch}</strong> ■ touch-up</span>
          <span><strong>{tally.repaint}</strong> ✕ repaint</span>
          {tally.developing > 0 && <span className="ps-dim"><strong>{tally.developing}</strong> ◌ developing</span>}
          {tally.awaiting > 0 && <span className="ps-dim"><strong>{tally.awaiting}</strong> ◌ awaiting</span>}
          {tally.missing > 0 && <span className="ps-flag"><strong>{tally.missing}</strong> ✕ missing</span>}
        </div>
      </header>

      <div className="ps-tools panel">
        <div className="ps-toolgroup" role="toolbar" aria-label="Faction filter">
          <span className="ps-toollabel">Wall</span>
          <button className={`ps-tchip ${factionFilter === 'all' ? 'on' : ''}`} onClick={() => setFactionFilter('all')}>
            All {WALL.length}
          </button>
          {FACTION_ORDER.map((fid) => {
            const count = WALL.filter((e) => e.faction.id === fid).length;
            const f = WALL.find((e) => e.faction.id === fid)!.faction;
            return (
              <button
                key={fid}
                className={`ps-tchip ${factionFilter === fid ? 'on' : ''}`}
                onClick={() => setFactionFilter(fid)}
              >
                <i style={{ color: f.color, fontStyle: 'normal' }} aria-hidden="true">{f.glyph}</i> {f.name.replace(/^The /, '')} {count}
              </button>
            );
          })}
        </div>
        <div className="ps-toolgroup" role="toolbar" aria-label="Sort order">
          <span className="ps-toollabel">Hang by</span>
          {(
            [
              ['name', 'Name'],
              ['grade', 'Grade'],
              ['warmth', 'Warmth'],
            ] as [SortMode, string][]
          ).map(([id, label]) => (
            <button key={id} className={`ps-tchip ${sort === id ? 'on' : ''}`} onClick={() => setSort(id)}>
              {label}
            </button>
          ))}
        </div>
        <p className="ps-tools-note dim">
          Grades develop live — a frame’s glyph is its verdict, its colour only repeats it.
        </p>
      </div>

      <div className="ps-body">
        <Wall
          entries={visible}
          checksById={checksById}
          analysed={new Set(analyses.keys())}
          selected={selected.character.id}
          onSelect={onSelect}
        />
        <Booth
          entry={selected}
          analysis={selAnalysis}
          checks={selChecks}
          developing={selDeveloping}
          analyses={analyses}
          entriesById={entriesById}
        />
      </div>

      <footer className="ps-foot">
        <p>
          Bench rules: the warm-key window comes from DESIGN.md’s lighting recipe; faction chips are
          the DESIGN.md palette hexes; a portrait only passes “At 64px” if the face still holds
          together at the size the dialogue box actually renders. A failing check doesn’t argue — it
          writes itself onto the shot list.
        </p>
      </footer>
    </div>
  );
}

/* Region registry contract: register quietly as an off-world, no-props region. */
const moduleExport = PortraitStation as typeof PortraitStation & Partial<RegionModule>;
moduleExport.meta = regionMeta;
moduleExport.anchors = regionAnchors;

export default moduleExport;
