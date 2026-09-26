/**
 * TIMELINE — every entrance beat as a bar, the font swap as a diamond hoist,
 * and the menu-ready budget as a rule line. Warnings are glyph + colour pairs
 * (✓ teal, ▲ amber, ▯ red) — shape carries the news, colour only decorates.
 */
import {
  MENU_READY_BUDGET_MS,
  SETTLE_BUDGET_MS,
  menuReadyAt,
  settleAt,
  type Beat,
} from './tokens';

interface TimelineProps {
  schedule: Beat[];
  fontDelayMs: number;
}

export function Timeline({ schedule, fontDelayMs }: TimelineProps) {
  const settle = settleAt(schedule);
  const ready = menuReadyAt(schedule);
  const span = Math.max(settle, fontDelayMs, SETTLE_BUDGET_MS) * 1.02;
  const pct = (ms: number) => `${((ms / span) * 100).toFixed(2)}%`;

  const readyOk = ready <= MENU_READY_BUDGET_MS;
  const settleOk = settle <= SETTLE_BUDGET_MS;
  const fontBeforeMenu = fontDelayMs <= ready;

  return (
    <section className="tml-timeline panel" aria-label="Entrance choreography timeline">
      <header className="tml-tl-head">
        <h3>Choreography timeline</h3>
        <div className="tml-tl-chips">
          <span className={`tml-chip ${readyOk ? 'teal' : 'amber'}`}>
            <b>{readyOk ? '✓' : '▲'}</b> menu actionable at {Math.round(ready)}ms
            {readyOk ? '' : ` — over the ${MENU_READY_BUDGET_MS}ms budget`}
          </span>
          <span className={`tml-chip ${settleOk ? 'teal' : 'amber'}`}>
            <b>{settleOk ? '✓' : '▲'}</b> fully settled at {Math.round(settle)}ms
            {settleOk ? '' : ` — over the ${SETTLE_BUDGET_MS}ms budget`}
          </span>
          <span className={`tml-chip ${fontBeforeMenu ? 'teal' : 'amber'}`}>
            <b>◆</b> faces swap at {fontDelayMs}ms —{' '}
            {fontDelayMs === 0
              ? 'cached, no flash'
              : fontBeforeMenu
                ? 'land before the menu is actionable'
                : 'land after the menu — entrance never blocks'}
          </span>
        </div>
      </header>

      <ol className="tml-tl-rows">
        {schedule.map((b) => (
          <li key={b.id} className={`tml-tl-row g-${b.group}`}>
            <span className="tml-tl-label">
              <i aria-hidden="true">{b.glyph}</i> {b.label}
            </span>
            <span className="tml-tl-track">
              <span
                className="tml-tl-bar"
                style={{ left: pct(b.start), width: pct(b.end - b.start) }}
              />
              <span className="tml-tl-when">{Math.round(b.start)}ms</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="tml-tl-ruler" aria-hidden="true">
        {fontDelayMs > 0 && (
          <span className="tml-tl-mark font" style={{ left: pct(fontDelayMs) }}>
            ◆<em>font swap</em>
          </span>
        )}
        <span className="tml-tl-mark budget" style={{ left: pct(MENU_READY_BUDGET_MS) }}>
          ┃<em>menu budget {MENU_READY_BUDGET_MS}ms</em>
        </span>
        <span className="tml-tl-mark settle" style={{ left: pct(SETTLE_BUDGET_MS) }}>
          ┃<em>settle budget {SETTLE_BUDGET_MS}ms</em>
        </span>
      </div>

      <div className="tml-tl-legend">
        <span className="g-structure">◆ structure</span>
        <span className="g-epilogue">▣ epilogue</span>
        <span className="g-menu">◈ menu</span>
        <span className="g-tail">⌁ tail</span>
      </div>
    </section>
  );
}
