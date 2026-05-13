import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/store/user', () => ({
  $isLoggedIn: { get: vi.fn().mockReturnValue(false) },
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import splash from '../splash';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedUser = userStore as unknown as {
  $isLoggedIn: { get: ReturnType<typeof vi.fn> };
};
const mockedRouter = router as unknown as {
  navigate: ReturnType<typeof vi.fn>;
};

describe('splash route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns an HTMLElement with class splash synchronously', () => {
    mockedUser.$isLoggedIn.get.mockReturnValueOnce(false);
    const el = splash();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('splash')).toBe(true);
    expect(el.querySelector('.splash-logo-mark')).not.toBeNull();
    expect(el.querySelector('.splash-title')?.textContent).toBe('Yummi Go');
  });

  it('reveals Get Started + Login CTAs after 1.2s when not logged in', async () => {
    mockedUser.$isLoggedIn.get.mockReturnValue(false);
    const el = splash();
    expect(el.querySelector<HTMLElement>('#splash-actions')?.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(1300);
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLElement>('#splash-actions')?.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('#splash-loader')?.hidden).toBe(true);
  });

  it('Get Started CTA navigates to /onboarding/diet-survey', async () => {
    mockedUser.$isLoggedIn.get.mockReturnValue(false);
    const el = splash();
    await vi.advanceTimersByTimeAsync(1300);
    el.querySelector<HTMLButtonElement>('#get-started')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/diet-survey');
  });

  it('Login CTA navigates to /login', async () => {
    mockedUser.$isLoggedIn.get.mockReturnValue(false);
    const el = splash();
    await vi.advanceTimersByTimeAsync(1300);
    el.querySelector<HTMLButtonElement>('#goto-login')?.click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to /home after 1.2s when logged in', async () => {
    mockedUser.$isLoggedIn.get.mockReturnValue(true);
    splash();
    await vi.advanceTimersByTimeAsync(1300);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });
});
