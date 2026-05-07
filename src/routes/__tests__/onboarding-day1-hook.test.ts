import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  storage: { set: vi.fn(), get: vi.fn(), remove: vi.fn() },
  KEYS: { CHALLENGE_STARTED_AT: 'yummi.challengeStartedAt' },
}));

import day1Hook from '../onboarding/day1-hook';
import * as router from '@/router';
import * as storageLib from '@/lib/storage';

const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };
const mockedStorage = storageLib as unknown as { storage: { set: ReturnType<typeof vi.fn> } };

describe('onboarding/day1-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the fog overlay, egg, and CTA', () => {
    const el = day1Hook();
    expect(el.classList.contains('day1')).toBe(true);
    expect(el.querySelector('.fog-overlay')).not.toBeNull();
    expect(el.querySelector('.day1-egg')).not.toBeNull();
    expect(el.querySelector('#enter-btn')).not.toBeNull();
    // 6 of 6 dots done
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(6);
  });

  it('CTA stamps challenge start time then navigates to /check-in', () => {
    const el = day1Hook();
    (el.querySelector('#enter-btn') as HTMLButtonElement).click();
    expect(mockedStorage.storage.set).toHaveBeenCalledWith(
      'yummi.challengeStartedAt',
      expect.any(Number),
    );
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in');
  });
});
