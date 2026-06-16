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

import baseline from '../onboarding/baseline';
import * as profileApi from '@/api/profile';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedProfile = profileApi as unknown as { updateProfile: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as { $user: { get: ReturnType<typeof vi.fn> } };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('onboarding/baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser.$user.get.mockReturnValue({ id: 5, username: 'a', displayName: 'A' });
  });

  it('renders 2 sliders (肉食 + 蔬食) with default values', () => {
    const el = baseline();
    expect(el.querySelectorAll('.baseline-slider').length).toBe(2);
    expect(el.querySelectorAll('.baseline-row').length).toBe(2);
    expect(el.querySelector('.baseline-row[data-key="meat"]')).not.toBeNull();
    expect(el.querySelector('.baseline-row[data-key="plant"]')).not.toBeNull();
  });

  it('moving the 肉食 slider auto-rebalances 蔬食 to 100 - meat', () => {
    const el = baseline();
    document.body.appendChild(el);
    const meatSlider = el.querySelector('.baseline-slider[data-key="meat"]') as HTMLInputElement;
    const plantSlider = el.querySelector('.baseline-slider[data-key="plant"]') as HTMLInputElement;
    meatSlider.value = '40';
    meatSlider.dispatchEvent(new Event('input'));
    expect(el.querySelector('[data-bind="meat-pct"]')!.textContent).toBe('40%');
    expect(el.querySelector('[data-bind="plant-pct"]')!.textContent).toBe('60%');
    expect(plantSlider.value).toBe('60');
    document.body.removeChild(el);
  });

  it('moving the 蔬食 slider auto-rebalances 肉食 to 100 - plant', () => {
    const el = baseline();
    document.body.appendChild(el);
    const meatSlider = el.querySelector('.baseline-slider[data-key="meat"]') as HTMLInputElement;
    const plantSlider = el.querySelector('.baseline-slider[data-key="plant"]') as HTMLInputElement;
    plantSlider.value = '80';
    plantSlider.dispatchEvent(new Event('input'));
    expect(el.querySelector('[data-bind="plant-pct"]')!.textContent).toBe('80%');
    expect(el.querySelector('[data-bind="meat-pct"]')!.textContent).toBe('20%');
    expect(meatSlider.value).toBe('20');
    document.body.removeChild(el);
  });

  it('continue button is always enabled — the two sliders auto-sum to 100', () => {
    const el = baseline();
    document.body.appendChild(el);
    const cont = el.querySelector<HTMLButtonElement>('#continue-btn')!;
    expect(cont.disabled).toBe(false);
    const meatSlider = el.querySelector('.baseline-slider[data-key="meat"]') as HTMLInputElement;
    meatSlider.value = '90';
    meatSlider.dispatchEvent(new Event('input'));
    expect(cont.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it('continue button writes the expanded Baseline JSON and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = baseline();
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, patch] = mockedProfile.updateProfile.mock.calls[0];
    expect(userId).toBe(5);
    expect(typeof patch.baseline).toBe('string');
    const parsed = JSON.parse(patch.baseline);
    // Default meat = 70 → expanded into MEAT_MIX × 0.7 for each kind,
    // plus plant = 0.3.
    expect(parsed).toHaveProperty('beef');
    expect(parsed).toHaveProperty('chicken');
    expect(parsed).toHaveProperty('plant');
    expect(parsed.plant).toBeCloseTo(0.3, 5);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/purpose');
  });

  it('back button navigates to diet-survey', () => {
    const el = baseline();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });
});
