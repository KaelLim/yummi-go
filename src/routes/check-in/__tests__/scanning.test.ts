import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/router', () => ({ navigate: vi.fn() }));
vi.mock('@/lib/mock-ai', () => ({
  mockScan: vi.fn(),
}));

import scanning from '../scanning';
import { $checkin, resetCheckin, setCapture } from '@/store/checkin';
import * as ai from '@/lib/mock-ai';
import * as router from '@/router';

const mockedAi = ai as unknown as { mockScan: ReturnType<typeof vi.fn> };
const mockedRouter = router as unknown as { navigate: ReturnType<typeof vi.fn> };

describe('check-in/scanning route', () => {
  beforeEach(() => {
    resetCheckin();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('shows fallback when no captured image is in store', () => {
    const el = scanning();
    expect(el.querySelector('.checkin-fallback')).not.toBeNull();
  });

  it('renders scan frame when image is present', () => {
    setCapture('data:image/png;base64,xxx');
    const el = scanning();
    expect(el.querySelector('.scan-frame')).not.toBeNull();
    expect(el.querySelector('.scan-grid')).not.toBeNull();
    expect(el.querySelector('.scan-line')).not.toBeNull();
  });

  it('after 2s on success, sets scan and routes to /check-in/result', async () => {
    setCapture('data:image/png;base64,xxx');
    const fakeScan = {
      items: [{ name: 'a', cal: 10, protein: 0, carb: 0, fat: 0, fiber: 0, isVeg: true, colors: [], weightG: 50 }],
      hasMeat: false,
      scanFailed: false,
    };
    mockedAi.mockScan.mockReturnValueOnce(fakeScan);
    const el = scanning();
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(2000);
    expect($checkin.get().scan).toEqual(fakeScan);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/result');
    el.remove();
  });

  it('on scanFailed surfaces a retry CTA without navigating', async () => {
    setCapture('data:image/png;base64,xxx');
    mockedAi.mockScan.mockReturnValueOnce({ items: [], hasMeat: false, scanFailed: true });
    const el = scanning();
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockedRouter.navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain('辨識失敗');
    el.remove();
  });
});
