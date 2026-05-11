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

  it('renders 4 sliders with default values', () => {
    const el = baseline();
    expect(el.querySelectorAll('.baseline-slider').length).toBe(4);
    expect(el.querySelectorAll('.baseline-row').length).toBe(4);
  });

  it('dragging a slider down within headroom updates the displayed % and total', () => {
    // Defaults sum to 100 (beef 20 + pork 30 + lamb 0 + chicken 50). Drag
    // chicken down — total drops, displayed value matches.
    const el = baseline();
    document.body.appendChild(el);
    const chickenSlider = el.querySelector('.baseline-slider[data-key="chicken"]') as HTMLInputElement;
    chickenSlider.value = '10';
    chickenSlider.dispatchEvent(new Event('input'));
    const chickenRow = el.querySelector('.baseline-row[data-key="chicken"]')!;
    expect(chickenRow.querySelector('.baseline-value')!.textContent).toBe('10%');
    expect(el.querySelector('#total-pct')!.textContent).toBe('60%');
    document.body.removeChild(el);
  });

  it('clamps slider to remaining headroom so total never exceeds 100%', () => {
    // Defaults already sum to 100 (beef 20 + pork 30 + lamb 0 + chicken 50).
    // Dragging beef up to 40 should clamp at 20 (no headroom left).
    const el = baseline();
    document.body.appendChild(el);
    const beefSlider = el.querySelector('.baseline-slider[data-key="beef"]') as HTMLInputElement;
    beefSlider.value = '40';
    beefSlider.dispatchEvent(new Event('input'));
    const beefRow = el.querySelector('.baseline-row[data-key="beef"]')!;
    expect(beefRow.querySelector('.baseline-value')!.textContent).toBe('20%');
    expect(beefSlider.value).toBe('20'); // visually snaps back to the cap
    expect(el.querySelector('#total-pct')!.textContent).toBe('100%');
    document.body.removeChild(el);
  });

  it('once total is 100%, other bars can only slide down (not up)', () => {
    const el = baseline();
    document.body.appendChild(el);
    // lamb starts at 0 with no headroom; dragging it up should pin at 0.
    const lambSlider = el.querySelector('.baseline-slider[data-key="lamb"]') as HTMLInputElement;
    lambSlider.value = '25';
    lambSlider.dispatchEvent(new Event('input'));
    const lambRow = el.querySelector('.baseline-row[data-key="lamb"]')!;
    expect(lambRow.querySelector('.baseline-value')!.textContent).toBe('0%');
    expect(el.querySelector('#total-pct')!.textContent).toBe('100%');

    // Free up headroom by sliding pork down, then lamb can climb into it.
    const porkSlider = el.querySelector('.baseline-slider[data-key="pork"]') as HTMLInputElement;
    porkSlider.value = '10';
    porkSlider.dispatchEvent(new Event('input'));
    lambSlider.value = '25';
    lambSlider.dispatchEvent(new Event('input'));
    expect(lambRow.querySelector('.baseline-value')!.textContent).toBe('20%');
    expect(el.querySelector('#total-pct')!.textContent).toBe('100%');
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
