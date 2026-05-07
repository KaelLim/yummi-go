import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/store/user', () => ({
  bootstrapFromStorage: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import splash from '../splash';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedUser = userStore as unknown as {
  bootstrapFromStorage: ReturnType<typeof vi.fn>;
};
const mockedRouter = router as unknown as {
  navigate: ReturnType<typeof vi.fn>;
};

describe('splash route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns an HTMLElement with class splash', async () => {
    mockedUser.bootstrapFromStorage.mockResolvedValueOnce(false);
    const promise = splash();
    // Advance past the 1.2s minimum hold.
    await vi.advanceTimersByTimeAsync(1300);
    const el = await promise;
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('splash')).toBe(true);
    expect(el.querySelector('.splash-logo-mark')).not.toBeNull();
    expect(el.querySelector('.splash-title')?.textContent).toBe('Yummi Go');
  });

  it('navigates to /login when no session is restored', async () => {
    mockedUser.bootstrapFromStorage.mockResolvedValueOnce(false);
    const promise = splash();
    await vi.advanceTimersByTimeAsync(1300);
    await promise;
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/login');
  });

  it('navigates to /home when session is restored', async () => {
    mockedUser.bootstrapFromStorage.mockResolvedValueOnce(true);
    const promise = splash();
    await vi.advanceTimersByTimeAsync(1300);
    await promise;
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
  });
});
