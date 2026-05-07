import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
}));

vi.mock('@/store/user', () => ({
  setLoggedInUser: vi.fn(),
}));

vi.mock('@/router', () => ({
  navigate: vi.fn(),
}));

import login from '../login';
import * as authApi from '@/api/auth';
import * as userStore from '@/store/user';
import * as router from '@/router';

const mockedAuth = authApi as unknown as { login: ReturnType<typeof vi.fn> };
const mockedUser = userStore as unknown as {
  setLoggedInUser: ReturnType<typeof vi.fn>;
};
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('login route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an HTMLElement with class auth-screen and a form', () => {
    const el = login();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('auth-screen')).toBe(true);
    expect(el.querySelector('#login-form')).not.toBeNull();
    expect(el.querySelector('input[name="username"]')).not.toBeNull();
    expect(el.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('back button navigates to splash', () => {
    const el = login();
    (el.querySelector('#back-btn') as HTMLElement).click();
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('blocks submit when fields are empty (no auth call)', async () => {
    const el = login();
    document.body.appendChild(el);
    const form = el.querySelector('#login-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    expect(mockedAuth.login).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('on successful login, sets user and navigates to /home', async () => {
    mockedAuth.login.mockResolvedValueOnce({
      id: 1,
      username: 'alice',
      displayName: 'Alice',
    });
    const el = login();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'alice';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'secret';
    const form = el.querySelector('#login-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    expect(mockedAuth.login).toHaveBeenCalledWith('alice', 'secret');
    expect(mockedUser.setLoggedInUser).toHaveBeenCalledWith({
      id: 1,
      username: 'alice',
      displayName: 'Alice',
    });
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/home');
    document.body.removeChild(el);
  });

  it('on failure, shows error and re-enables submit button', async () => {
    mockedAuth.login.mockRejectedValueOnce(new Error('bad creds'));
    const el = login();
    document.body.appendChild(el);
    (el.querySelector('input[name="username"]') as HTMLInputElement).value = 'a';
    (el.querySelector('input[name="password"]') as HTMLInputElement).value = 'b';
    const form = el.querySelector('#login-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    await flush();
    const err = el.querySelector('#error-msg') as HTMLDivElement;
    const btn = el.querySelector('#submit-btn') as HTMLButtonElement;
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain('登入失敗');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('登入');
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });
});
