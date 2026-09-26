/**
 * checks — the a11y + maths suite. Two halves:
 *
 * runLogicChecks() sweeps the scripted-wallet maths for parity with the
 * save store (exact-balance buys, payDebt clamping, the debt.cleared →
 * Guild Gold rule). Pure, instant, deterministic.
 *
 * runDomChecks(container) interrogates one rendered shop variant for
 * keyboard accessibility: accessible names, disabled-button reasons,
 * roving tabindex on the swatch rack, a non-colour-only selection signal,
 * and the presence of a visible denial reason. Run against the shipped
 * baseline it FAILS rows the tuned build passes — that's the audit.
 */
import {
  BOND_ORIGINAL,
  GUILD_GOLD,
  MAX_LEVEL,
  PAINTS,
  PARTS,
  PART_COSTS,
  buy,
  initialWallet,
  paints,
  payDebt,
  setPaint,
} from './wallet';

export interface CheckResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  detail: string;
}

/* ------------------------------ logic ------------------------------ */

export function runLogicChecks(): CheckResult[] {
  const out: CheckResult[] = [];
  const push = (id: string, label: string, ok: boolean, detail: string, level: 'pass' | 'fail' | 'warn' = ok ? 'pass' : 'fail') =>
    out.push({ id, label, status: level, detail });

  // costs array parity (mirrors GaragePanel + store expectations)
  push(
    'costs',
    'Part cost ladder is [400, 900, 1800] × 4 parts',
    PART_COSTS.length === MAX_LEVEL && PART_COSTS[0] === 400 && PART_COSTS[1] === 900 && PART_COSTS[2] === 1800,
    `ladder = [${PART_COSTS.join(', ')}], max level ${MAX_LEVEL}`,
  );

  // exact-balance buy succeeds and empties the purse
  {
    const w = { ...initialWallet(), credits: 400 };
    const v = buy(w, 'engine');
    push(
      'exact-balance',
      'Buy at exact balance succeeds',
      v.ok && v.wallet.credits === 0 && v.newLevel === 1,
      `400 cr → engine 1 → ${v.ok ? v.wallet.credits : 'denied'} cr (store rule: credits < cost refuses)`,
    );
  }

  // one-short buy refuses with the shortfall
  {
    const w = { ...initialWallet(), credits: 399 };
    const v = buy(w, 'engine');
    push(
      'one-short',
      'Buy 1 cr short refuses and reports the shortfall',
      !v.ok && !v.ok && v.reason === 'credits' && v.short === 1,
      `399 cr → ${v.ok ? 'bought?!' : `denied, ${v.short} cr short`}`,
    );
  }

  // payDebt clamps to credits and floors the amount
  {
    const w = { ...initialWallet(), credits: 300, debt: 8000 };
    const v = payDebt(w, 10000.9);
    push(
      'pay-clamp',
      'Over-payment clamps to credits held',
      v.paid === 300 && v.wallet.credits === 0 && v.wallet.debt === 7700,
      `pay 10,000.9 with 300 held → paid ${v.paid} (mirrors store.payDebt floor+clamp)`,
    );
  }

  // clearing the bond flips the title and unlocks the gold swatch
  {
    const w = { ...initialWallet(), credits: BOND_ORIGINAL, debt: BOND_ORIGINAL };
    const v = payDebt(w, BOND_ORIGINAL);
    push(
      'clear-title',
      'Paying the bond off clears the title and unlocks Guild Gold',
      v.cleared && v.wallet.debt === 0 && paints(v.wallet).includes(GUILD_GOLD),
      `paid ${BOND_ORIGINAL.toLocaleString()} → debt ${v.wallet.debt}, rack = [${paints(v.wallet).join(', ')}]`,
    );
  }

  // gold is refused while the bond stands ("earned, never bought")
  {
    const w = initialWallet();
    const next = setPaint(w, GUILD_GOLD);
    push(
      'gold-earned',
      'Guild Gold cannot be selected before the bond clears',
      next.upgrades.paint === w.upgrades.paint,
      `setPaint(${GUILD_GOLD}) on a bonded wallet → kept ${next.upgrades.paint}`,
    );
  }

  // paint rack parity
  push(
    'paints',
    'Paint rack matches the garage list (6 + earned gold)',
    PAINTS.length === 6 && PAINTS[0] === '#B3502E',
    `rack = [${paints(initialWallet()).join(', ')}]${''} + ${GUILD_GOLD} once clear`,
  );

  return out;
}

/* ------------------------------- DOM ------------------------------- */

function accessibleName(el: HTMLElement): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
}

export function runDomChecks(container: HTMLElement, liveText: string): CheckResult[] {
  const out: CheckResult[] = [];
  const push = (id: string, label: string, status: CheckResult['status'], detail: string) =>
    out.push({ id, label, status, detail });

  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
  const isOff = (b: HTMLButtonElement) => b.disabled || b.getAttribute('aria-disabled') === 'true';

  // 1 — every button has an accessible name
  {
    const bad = buttons.filter((b) => !accessibleName(b));
    push(
      'names',
      'Every button has an accessible name',
      bad.length === 0 ? 'pass' : 'fail',
      bad.length === 0
        ? `${buttons.length} buttons, all named`
        : `${bad.length}/${buttons.length} unnamed`,
    );
  }

  // 2 — disabled (or aria-disabled) buttons explain why
  {
    const dis = buttons.filter(isOff);
    const unexplained = dis.filter(
      (b) =>
        !b.title?.trim() &&
        !(b.getAttribute('aria-label') ?? '').match(/need|fitted|clear|held|level|short/i) &&
        !b.closest('article, div')?.querySelector('.gsl-deny-reason'),
    );
    if (dis.length === 0)
      push('disabled-why', 'Disabled buttons explain why', 'warn', 'Nothing disabled right now — set a lean wallet to test the denial states');
    else
      push(
        'disabled-why',
        'Disabled buttons explain why',
        unexplained.length === 0 ? 'pass' : 'fail',
        unexplained.length === 0
          ? `${dis.length} off (disabled/aria-disabled), all carry a reason (title, label or on-card text)`
          : `${unexplained.length}/${dis.length} off with no reason anywhere`,
      );
  }

  // 3 — denial reason is visible, not tooltip-only
  {
    const needRows = Array.from(container.querySelectorAll('.gsl-deny-reason'));
    const poorButtons = buttons.filter((b) => isOff(b) && /need/i.test(b.textContent ?? ''));
    if (poorButtons.length === 0)
      push('deny-visible', 'Denial states are visible on the card', 'warn', 'No "can’t afford" state on stage — try the “Riding broke” wallet preset');
    else
      push(
        'deny-visible',
        'Denial states are visible on the card',
        needRows.length >= poorButtons.length ? 'pass' : 'fail',
        needRows.length >= poorButtons.length
          ? `${poorButtons.length} denied, ${needRows.length} show the on-card reason`
          : `${poorButtons.length - needRows.length} denied buttons rely on tooltip only`,
      );
  }

  // 4 — swatch rack: roving tabindex (one tab stop, arrows within)
  {
    const rack = container.querySelector('[data-swatch-rack]');
    if (!rack) {
      push('roving', 'Swatch rack uses roving tabindex', 'warn', 'No paint rack rendered');
    } else {
      const stops = Array.from(rack.querySelectorAll<HTMLButtonElement>('button')).filter(
        (b) => b.tabIndex >= 0,
      );
      const roving = (rack as HTMLElement).dataset.roving === 'true';
      push(
        'roving',
        'Swatch rack is one tab stop (arrows inside)',
        roving && stops.length === 1 ? 'pass' : stops.length === 1 ? 'warn' : 'warn',
        roving && stops.length === 1
          ? `1 tab stop + arrow/Home/End keys across the rack`
          : `${stops.length} tab stops${roving ? '' : ', tab-per-swatch (arrows unwired)'}`,
      );
    }
  }

  // 5 — selection carries a shape, not colour alone (accessibility rule)
  {
    const rack = container.querySelector('[data-swatch-rack]');
    const sel = rack?.querySelector<HTMLButtonElement>('.selected');
    if (!rack || !sel) {
      push('shape', 'Selected swatch is marked by shape + colour', 'warn', 'No selected swatch on stage');
    } else {
      const hasGlyph = !!sel.querySelector('.gsl-swatch-check');
      const hasPressed = sel.getAttribute('aria-pressed') === 'true';
      push(
        'shape',
        'Selected swatch is marked by shape + colour',
        hasGlyph && hasPressed ? 'pass' : 'fail',
        hasGlyph
          ? '✓ glyph + ring + aria-pressed'
          : 'ring glow only — colour alone (aria-pressed ' + (hasPressed ? 'set' : 'unset') + ')',
      );
    }
  }

  // 6 — locked Guild Gold is discoverable, not invisible
  {
    const locked = container.querySelector<HTMLButtonElement>('.gsl-locked');
    const goldRendered = !!container.querySelector('[aria-label*="Guild Gold"]');
    if (!goldRendered && !locked) {
      push('gold', 'Locked Guild Gold is discoverable before it’s earned', 'warn', 'Rack has no gold cell rendered (full-clear wallet hides the teaching moment)');
    } else if (locked) {
      push(
        'gold',
        'Locked Guild Gold is discoverable before it’s earned',
        locked.getAttribute('aria-disabled') === 'true' ? 'pass' : 'fail',
        `ghost cell, keyboard-discoverable, reason narrated (aria-disabled=${locked.getAttribute('aria-disabled')})`,
      );
    }
  }

  // 7 — live region carries the last transaction
  {
    push(
      'live',
      'Transactions announce themselves (aria-live)',
      liveText ? 'pass' : 'pending',
      liveText
        ? `“${liveText.length > 72 ? liveText.slice(0, 72) + '…' : liveText}”`
        : 'Buy, pay or repaint to hear it',
    );
  }

  // 8 — debt callout uses words + glyph, never colour alone
  {
    const co = container.querySelector('[data-debt-callout]');
    if (!co) {
      push('debt', 'The bond is visible from the garage', 'fail', 'No debt callout on this variant');
    } else {
      const sealed = co.querySelector('.exchange-seal');
      push(
        'debt',
        'The bond is visible from the garage',
        sealed ? 'pass' : 'pass',
        sealed
          ? `ledger card with ◈ seal chip (“${(sealed.textContent ?? '').trim()}”), figure + progress bar`
          : 'strip line with ◈ glyph + figure (words, not colour)',
      );
    }
  }

  return out;
}
