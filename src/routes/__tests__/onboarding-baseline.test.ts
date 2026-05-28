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

  it('renders 5 sliders (4 meat + 蔬食) with default values', () => {
    const el = baseline();
    expect(el.querySelectorAll('.baseline-slider').length).toBe(5);
    expect(el.querySelectorAll('.baseline-row').length).toBe(5);
    expect(el.querySelector('.baseline-row[data-key="plant"]')).not.toBeNull();
  });

  it('dragging a slider updates the displayed % and total', () => {
    // Defaults sum to 100 (beef 15 + pork 25 + lamb 5 + chicken 35 + plant 20).
    // Drag chicken down — total drops to 75%, displayed value matches.
    const el = baseline();
    document.body.appendChild(el);
    const chickenSlider = el.querySelector('.baseline-slider[data-key="chicken"]') as HTMLInputElement;
    chickenSlider.value = '10';
    chickenSlider.dispatchEvent(new Event('input'));
    const chickenRow = el.querySelector('.baseline-row[data-key="chicken"]')!;
    expect(chickenRow.querySelector('.baseline-value')!.textContent).toBe('10%');
    expect(el.querySelector('#total-pct')!.textContent).toBe('75%');
    document.body.removeChild(el);
  });

  it('sliders move freely past 100% — no headroom cap during input', () => {
    // Defaults sum to 100. Drag beef up to 40 → total displayed as 125%
    // (defaults 100 - beef 15 + 40 = 125). The 100% rule kicks in at
    // submit time, not during slider drag.
    const el = baseline();
    document.body.appendChild(el);
    const beefSlider = el.querySelector('.baseline-slider[data-key="beef"]') as HTMLInputElement;
    beefSlider.value = '40';
    beefSlider.dispatchEvent(new Event('input'));
    const beefRow = el.querySelector('.baseline-row[data-key="beef"]')!;
    expect(beefRow.querySelector('.baseline-value')!.textContent).toBe('40%');
    expect(beefSlider.value).toBe('40');
    expect(el.querySelector('#total-pct')!.textContent).toBe('125%');
    document.body.removeChild(el);
  });

  it('continue button is disabled when total ≠ 100% and re-enables when balanced', () => {
    const el = baseline();
    document.body.appendChild(el);
    const cont = el.querySelector<HTMLButtonElement>('#continue-btn')!;
    // Defaults sum to 100 — button starts enabled.
    expect(cont.disabled).toBe(false);

    // Tip the total over 100 by raising beef → button disables.
    const beefSlider = el.querySelector('.baseline-slider[data-key="beef"]') as HTMLInputElement;
    beefSlider.value = '50';
    beefSlider.dispatchEvent(new Event('input'));
    expect(cont.disabled).toBe(true);

    // Drop chicken to compensate (beef +35 → drop chicken 35→0 brings
    // total back to 100). Button enabled again.
    const chickenSlider = el.querySelector('.baseline-slider[data-key="chicken"]') as HTMLInputElement;
    chickenSlider.value = '0';
    chickenSlider.dispatchEvent(new Event('input'));
    expect(el.querySelector('#total-pct')!.textContent).toBe('100%');
    expect(cont.disabled).toBe(false);

    document.body.removeChild(el);
  });

  it('continue button writes baseline JSON and advances', async () => {
    mockedProfile.updateProfile.mockResolvedValueOnce(undefined);
    const el = baseline();
    (el.querySelector('#continue-btn') as HTMLButtonElement).click();
    await flush();
    expect(mockedProfile.updateProfile).toHaveBeenCalledTimes(1);
    const [userId, patch] = mockedProfile.updateProfile.mock.calls[0];
    expect(userId).toBe(5);
    expect(typeof patch.baseline).toBe('string');
    const parsed = JSON.parse(patch.baseline);
    expect(parsed).toHaveProperty('beef');
    expect(parsed).toHaveProperty('chicken');
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/purpose');
  });

  it('back button navigates to diet-survey', () => {
    const el = baseline();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });
});
