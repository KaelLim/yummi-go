/**
 * Gems + makeup-cards wallet helpers.
 *
 * Each user has exactly one gem_balances row and one makeup_cards row keyed
 * by user_id. drust list filters are silently ignored (see api/drust.ts), so
 * we fetch the page and filter client-side. swapGemsForCard atomically (from
 * the client's perspective) deducts the gem cost and bumps card_count.
 *
 * NOTE: drust does not expose multi-row transactions on the anon REST surface,
 * so a partial failure between the two PATCH calls would leave the user with
 * gems deducted but no card. The chance is small for a single demo and we
 * surface the error so the caller can refresh and retry.
 */
import { drust } from './drust';

export const GEMS_PER_CARD = 100;

export interface GemBalance {
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface MakeupCardsRow {
  id: number;
  user_id: number;
  card_count: number;
  fragment_count: number;
}

export async function getGemBalance(userId: number): Promise<GemBalance | null> {
  const result = await drust.list<GemBalance>('gem_balances');
  return result.records.find((r) => r.user_id === userId) ?? null;
}

export async function getMakeupCards(userId: number): Promise<MakeupCardsRow | null> {
  const result = await drust.list<MakeupCardsRow>('makeup_cards');
  return result.records.find((r) => r.user_id === userId) ?? null;
}

export async function swapGemsForCard(
  userId: number,
  cost: number = GEMS_PER_CARD,
): Promise<{ balance: number; cards: number }> {
  const [gem, mu] = await Promise.all([
    getGemBalance(userId),
    getMakeupCards(userId),
  ]);
  if (!gem) throw new Error('Gem balance not found');
  if (!mu) throw new Error('Makeup cards row not found');
  if (gem.balance < cost) throw new Error('寶石不足');

  await drust.update('gem_balances', gem.id, {
    balance: gem.balance - cost,
    total_spent: gem.total_spent + cost,
  });
  await drust.update('makeup_cards', mu.id, {
    card_count: mu.card_count + 1,
  });

  return { balance: gem.balance - cost, cards: mu.card_count + 1 };
}

/**
 * Spend a makeup card to retroactively count a missed day. Pure mutation —
 * the route is responsible for inserting the back-dated check-in once the
 * card is consumed.
 */
export async function spendMakeupCard(userId: number): Promise<{ cards: number }> {
  const mu = await getMakeupCards(userId);
  if (!mu) throw new Error('Makeup cards row not found');
  if (mu.card_count <= 0) throw new Error('沒有可用的補簽卡');
  await drust.update('makeup_cards', mu.id, {
    card_count: mu.card_count - 1,
  });
  return { cards: mu.card_count - 1 };
}

/**
 * Mint gems into the user's balance. Used by the dev panel to skip the
 * grind during demos; production code paths shouldn't call this since gem
 * accrual goes through the XP-overflow rules in lib/xp-calc.
 */
export async function addGems(userId: number, amount: number): Promise<{ balance: number }> {
  const gem = await getGemBalance(userId);
  if (!gem) throw new Error('Gem balance not found');
  const newBalance = gem.balance + amount;
  await drust.update('gem_balances', gem.id, {
    balance: newBalance,
    total_earned: gem.total_earned + Math.max(0, amount),
  });
  return { balance: newBalance };
}

/**
 * Mint fragments + auto-fold every 4 fragments into a makeup card. Same
 * dev-only escape hatch as addGems.
 */
export async function addFragments(
  userId: number,
  amount: number,
): Promise<{ fragments: number; cards: number }> {
  const mu = await getMakeupCards(userId);
  if (!mu) throw new Error('Makeup cards row not found');
  const total = mu.fragment_count + amount;
  const newCards = mu.card_count + Math.floor(total / 4);
  const newFragments = total % 4;
  await drust.update('makeup_cards', mu.id, {
    fragment_count: newFragments,
    card_count: newCards,
  });
  return { fragments: newFragments, cards: newCards };
}

/** Dev-only: zero out balance + total_earned + total_spent on gem_balances. */
export async function resetGems(userId: number): Promise<void> {
  const gem = await getGemBalance(userId);
  if (!gem) throw new Error('Gem balance not found');
  await drust.update('gem_balances', gem.id, {
    balance: 0,
    total_earned: 0,
    total_spent: 0,
  });
}

/** Dev-only: zero out card_count + fragment_count on makeup_cards. */
export async function resetMakeup(userId: number): Promise<void> {
  const mu = await getMakeupCards(userId);
  if (!mu) throw new Error('Makeup cards row not found');
  await drust.update('makeup_cards', mu.id, {
    card_count: 0,
    fragment_count: 0,
  });
}
