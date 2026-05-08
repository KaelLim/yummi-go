import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/profile', () => ({
  updateProfile: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  $user: { get: vi.fn() },
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import eatTimes from '../onboarding/eat-times';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/eat-times', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 3, username: 'a', displayName: 'A' });
  });

  it('renders 3 time inputs with defaults', () => {
    const el = eatTimes();
    const inputs = el.querySelectorAll<HTMLInputElement>('.meal-input');
    expect(inputs.length).toBe(3);
    const keys = Array.from(inputs).map(i => i.dataset.key);
    expect(keys).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(inputs[0].value).toBe('08:00');
  });

  it('continue serializes eat_times JSON and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = eatTimes();
    document.body.appendChild(el);
    const lunchInput = el.querySelector('.meal-input[data-key="lunch"]') as HTMLInputElement;
    lunchInput.value = '13:15';
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, patch] = mockedProfile.updateProfile.mock.calls[0];
    expect(userId).toBe(3);
    const parsed = JSON.parse(patch.eat_times);
    expect(parsed.lunch).toBe('13:15');
    expect(parsed.breakfast).toBe('08:00');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/known-from');
    document.body.removeChild(el);
  });

  it('back button navigates to challenge-level', () => {
    const el = eatTimes();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/challenge-level');
  });
});
