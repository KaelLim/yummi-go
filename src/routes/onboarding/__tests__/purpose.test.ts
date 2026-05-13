import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/api/content', () => ({
  listChallengePurposes: vi.fn(),
}));

import purpose from '../purpose';
import * as router from '@/router';
import * as profileApi from '@/api/profile';
import * as contentApi from '@/api/content';
import { $user } from '@/store/user';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedProfile = profileApi as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};
const mockedContent = contentApi as unknown as {
  listChallengePurposes: ReturnType<typeof vi.fn>;
};

const SEED = [
  { id: 1, key: 'body',        emoji: '🏃', label: '健康',  sort_order: 1, active: 1 },
  { id: 2, key: 'environment', emoji: '🌱', label: '環保',  sort_order: 2, active: 1 },
  { id: 3, key: 'vow',         emoji: '🙏', label: '發願',  sort_order: 3, active: 1 },
];

describe('onboarding/purpose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedContent.listChallengePurposes.mockResolvedValue(SEED);
    $user.set({ id: 7, username: 'k', displayName: 'k' });
  });

  it('shows loading then 3 purpose options once the table resolves', async () => {
    const el = purpose();
    expect(el.querySelector('.quiz-loading')).not.toBeNull();
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.choice').length).toBe(3),
    );
    expect(el.querySelector('#skip-btn')).toBeNull();
  });

  it('shows progress 3/6', () => {
    const el = purpose();
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(6);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(3);
  });

  it('renders whatever the table returns (extra row, custom label)', async () => {
    mockedContent.listChallengePurposes.mockResolvedValueOnce([
      ...SEED,
      { id: 4, key: 'family', emoji: '👨‍👩‍👧', label: '家人健康', sort_order: 4, active: 1 },
    ]);
    const el = purpose();
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.choice').length).toBe(4),
    );
    expect(el.querySelector('.choice[data-value="family"]')).not.toBeNull();
  });

  it('clicking a purpose updates profile and advances to /onboarding/day1-hook', async () => {
    const el = purpose();
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.choice').length).toBe(3),
    );
    const btn = el.querySelector<HTMLButtonElement>('.choice[data-value="environment"]');
    btn?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(7, { purpose: 'environment' });
    await Promise.resolve();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
  });

  it('without a user, the click writes the draft instead of drust', async () => {
    $user.set(null);
    const { patchDraft } = await import('@/store/onboarding-draft');
    const spy = vi.spyOn({ patchDraft }, 'patchDraft');
    // patchDraft is a real impl — assert the side effect on the draft store instead.
    const { $onboardingDraft } = await import('@/store/onboarding-draft');
    $onboardingDraft.set({
      diet_type: null, baseline: null, purpose: null, challenge_level: null,
      eat_times: null, known_from: null, pet_name: null,
    });
    const el = purpose();
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.choice').length).toBe(3),
    );
    el.querySelector<HTMLButtonElement>('.choice[data-value="vow"]')?.click();
    await Promise.resolve();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect($onboardingDraft.get().purpose).toBe('vow');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/day1-hook');
    spy.mockRestore();
  });
});
