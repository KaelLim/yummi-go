import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/auth', () => ({
  register: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  setLoggedInUser: vi.fn(),
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import register from '../register';
import * as authApi from '@/api/auth';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedAuth = authApi as unknown as { register: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as {
  setLoggedInUser: ReturnType<typeof vi.fn>;
};
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('register route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an HTMLElement with class auth-screen and required inputs', () => {
    const el = register();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('auth-screen')).toBe(true);
    expect(el.querySelector('input[name="username"]')).not.toBeNull();
    expect(el.querySelector('input[name="display_name"]')).not.toBeNull();
    expect(el.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('back button navigates to /login', () => {
    const el = register();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/login');
  });

  it('blocks submit when fields are empty', async () => {
    const el = register();
    document.body.appendChild(el);
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(mockedAuth.register).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('on success, navigates to /onboarding/oath', async () => {
    mockedAuth.register.mockResolvedValueOnce({
      id: 9,
      username: 'newbie',
      displayName: 'Greenie',
    });
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'newbie';
    (el.querySelector('input[name="display_name"]') as HTMLInputElement).value = 'Greenie';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'sekret1';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    expect(mockedAuth.register).toHaveBeenCalledWith('newbie', 'sekret1', 'Greenie');
    expect(mockedUser.setLoggedInUser).toHaveBeenCalled();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/onboarding/oath');
    document.body.removeChild(el);
  });

  it('shows username-taken message on UNIQUE constraint failure', async () => {
    mockedAuth.register.mockRejectedValueOnce(
      new Error('UNIQUE constraint failed: users.username'),
    );
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'taken';
    (el.querySelector('input[name="display_name"]') as HTMLInputElement).value = 'X';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'abcdef';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    const err = el.querySelector('#reg-error') as HTMLDivElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('使用者名稱已被使用');
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('shows generic message on non-UNIQUE failure', async () => {
    mockedAuth.register.mockRejectedValueOnce(new Error('network down'));
    const el = register();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'a';
    (el.querySelector('input[name="display_name"]') as HTMLInputElement).value = 'b';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'cdefgh';
    const form = el.querySelector('#reg-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    const err = el.querySelector('#reg-error') as HTMLDivElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('註冊失敗');
    document.body.removeChild(el);
  });
});
