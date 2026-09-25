# DRIFTLINE — Story Bible (working canon)

Tone: warm, weathered, hopeful. Frontier-western meets solarpunk. Humour in dialogue —
dry, affectionate, never quippy-marvel. Everyone on Kessa-9 is tired, kind, and lying about something.

## The world

**Kessa-9**: half-terraformed when the money ran out, ~200 years ago. The terraforming AI
**MOTHER** went dormant mid-process. What's left: the **Glass Desert** (salt flats, canyons
fused to teal glass by old reactor burns), wind-farm ridges, mesa skyship docks. Settlements
are scattered; nothing moves between them except the **Driftline** couriers.

**The null crate** (chapter-one MacGuffin): a sealed courier crate that appears on no manifest,
hums when storms come, and is in fact a **wake-key** for MOTHER. Nobody admits sending it.
It was sent by MOTHER herself, through a printer that hasn't had power for a century. (Keep
this reveal for ch4.)

## Factions

- **Salt Guild** — trader co-op that owns the manifest ledgers, the job boards, and most of the
  water. Colour ochre. Motto: *"Everything crosses. Everything's counted."* Wants the crate
  *sold or shelved* — change is bad for margins.
  Key people: **Tamsin Cho** (factor, Saltmouth job board), **Brinemaster Ogo** (guildmaster),
  **Sister Counterweight** (auditor who weighs souls and salt with the same scale).
- **The Choir** — cult that worships dormant MOTHER, keeps the old terraform temples lit with
  teal lamps. Interpret static as scripture. Colour bright teal. Want the crate *delivered to
  MOTHER's cradle*, believing she'll finish the terraforming. Key people: **Cantor Ilex**
  (gentle, unnerving), **Static-Warden Pem** (listens to dead radios), **Little Reverb** (a kid
  who hears MOTHER clearest).
- **The Reclaimers** — scavenger union stripping old infrastructure before it kills someone,
  and for profit, in that order when convenient. Colour rust. Practical, funny, sentimental about
  old machines. Want the crate *opened* — a wake-key might restart machinery worth salvaging, or
  guarding. Key people: **Boss Pyke** (yard boss), **Solder** (young mechanic), **Aunt Vertex**
  (explosives theologian).
- **The Driftline** — the courier creed: *any crate, any storm, any door*. Neutral by oath.
  Colour amber. Key people: **Ketch** (retired legend, runs the Saltmouth garage), **Rill
  Davenant** (the courier who goes missing in ch3), **Ash Varga** (player character: new courier,
  second-hand bike named **the Wren** at player option, a debt to the Guild, dry internal monologue).

## Places (regions → `src/world/regions/<slug>/`)

- `saltmouth` — hub town where the salt flats meet the first dunes. Job board, Ketch's garage,
  guild exchange, water tower, moorage mast. HOME.
- `glassroad` — canyon run fused to teal glass by a reactor burn; fast, slick, dangerous. ch2.
- `windspine` — wind-farm ridge; turbines, survey camps; storm season starts here. ch3.
- `skydocks` — mesas with moored skyships; the guild's rich district in the air. ch2–4.
- `cinderflats` — reclaimer yards in a half-melted industrial scar. ch2–3.
- `choirhollow` — a crater temple of the Choir, ringed with teal lamps and listening horns. ch2, ch4.
- `drowned-array` — a solar array sinking into a salt pan; eerie, beautiful, full of caches. side.
- `mothersgate` — the sealed terraform cradle in the far glass hills. ch4–5. Locked until ch4.

## Player character

**Ash Varga** — 20s, new Driftline courier, owes the Guild 8,000 credits for the bike (a
second-hand hover named whatever the save file says; default *the Wren*). Competent, unimpressed,
kind when it costs something. Ash talks mostly on the radio, mostly to Ketch.

## Chapter map (6 story missions each; slugs `ch<N>-<slug>`)

1. **First Run** (`ch1-*`): learn bike/board/garage. Arc: a parcel job → the null crate arrives
   with no sender → deliver it one hop → it hums. Ends with Ash's name in a ledger it shouldn't be in.
2. **The Glass Road** (`ch2-*`): the hum spreads. All three factions formally ask for the crate
   (three "offer" missions; player can side-hop). A race down the glassroad; an escort gone wrong;
   the crate survives something it shouldn't. Ends with MOTHER's first word on the radio: "...ASH."
3. **Storm Season** (`ch3-*`): storms close routes; **Rill Davenant vanishes** mid-run. Rescue
   arc across windspine; factions trade accusations and favours; a storm-run mission (`storm`
   type) to outrun the season's first wall of sand. Ends: Rill found, half-mad, reciting coordinates.
4. **Mother's Voice** (`ch4-*`): the crate is a key; `mothersgate` unlocks. The desert changes
   (glass blooms, waypoints move). Choose which faction learns the gate combination — or keep it.
   Ends at the cradle door with the crate opening like a flower.
5. **Last Delivery** (`ch5-*`): one final run carrying MOTHER's choice-core through everything
   the world can throw. **Choice at the door** (≥2 endings):
   - *Ending A — "Rain"*: wake MOTHER fully. Terraforming resumes; the desert blooms; the
     factions' waste is washed out with the rain. Bittersweet: the Glass Desert dies so Kessa-9 lives.
   - *Ending B — "Quiet"*: return MOTHER to sleep. Keep the desert, the Driftline, the hard free
     life — and leave the deciding to whoever finds the next key.
   Both endings must be earnable and honoured; flags `ending.rain` / `ending.quiet`.

## Side jobs (30, `side-*`)

Bread-and-butter courier work that teaches regions and feeds the economy: mail runs, fragile
choir-glass deliveries, timed drops for the Guild, scavenger part collections, scout-viewpoint
surveys, storm-window deliveries, races against named rivals (**Jett Marrows** and the
**Quicklime Kid**), lost-crate hunts. Side jobs never gate chapters; they gate *upgrades
and gossip*.

## Flag conventions

`<missionId>.done`, `lore:<slug>` (codex unlock), faction standing via `rep` map (not flags),
story flags: `crate.hums`, `rill.missing`, `rill.found`, `gate.open`, `ending.rain`, `ending.quiet`.

## Names to keep handy (writers)

Settlements: Saltmouth, Keel Town (skydocks), the Yards (cinderflats), Lamp rest (choirhollow).
Tech: horizon cell (bike battery), salt-core (currency weight), manifest wax (seals), static
litanies (Choir prayers), wake-key (the crate).
Sayings: "Flat salt and a following wind." · "Count it twice." · "The Choir hears, the Guild
counts, the Reclaimers strip — and the Driftline carries."
