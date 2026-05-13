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

describe('check-in/scanning route (prototype dev picker)', () => {
  beforeEach(() => {
    resetCheckin();
    vi.clearAllMocks();
  });

  it('shows fallback when no captured image is in store', () => {
    const el = scanning();
    expect(el.querySelector('.checkin-fallback')).not.toBeNull();
  });

  it('renders scan frame + dev picker when image is present', () => {
    setCapture('data:image/png;base64,xxx');
    const el = scanning();
    expect(el.querySelector('.scan-frame')).not.toBeNull();
    expect(el.querySelector('.scan-grid')).not.toBeNull();
    expect(el.querySelector('#scan-veg')).not.toBeNull();
    expect(el.querySelector('#scan-meat')).not.toBeNull();
  });

  it('"無肉流程" button calls mockScan with forceMeat=false and routes to /check-in/result', () => {
    setCapture('data:image/png;base64,xxx');
    const fakeScan = {
      items: [{ name: '生菜', cal: 10, protein: 0, carb: 0, fat: 0, fiber: 0, isVeg: true, colors: [], weightG: 50 }],
      hasMeat: false,
      scanFailed: false,
    };
    mockedAi.mockScan.mockReturnValueOnce(fakeScan);
    const el = scanning();
    el.querySelector<HTMLButtonElement>('#scan-veg')?.click();
    expect(mockedAi.mockScan).toHaveBeenCalledWith({ forceMeat: false, failRate: 0 });
    expect($checkin.get().scan).toEqual(fakeScan);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/result');
  });

  it('"有肉流程" button calls mockScan with forceMeat=true and routes to /check-in/result', () => {
    setCapture('data:image/png;base64,xxx');
    const fakeScan = {
      items: [{ name: '牛肉片', cal: 250, protein: 26, carb: 0, fat: 17, fiber: 0, isVeg: false, colors: ['red'], weightG: 80 }],
      hasMeat: true,
      scanFailed: false,
    };
    mockedAi.mockScan.mockReturnValueOnce(fakeScan);
    const el = scanning();
    el.querySelector<HTMLButtonElement>('#scan-meat')?.click();
    expect(mockedAi.mockScan).toHaveBeenCalledWith({ forceMeat: true, failRate: 0 });
    expect($checkin.get().scan).toEqual(fakeScan);
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/check-in/result');
  });
});
