import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/profile', () => ({
  signOath: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/store/ui', () => ({
  setChallengeStartedAt: vi.fn().mockResolvedValue(undefined),
}));

import {
  $onboardingDraft,
  patchDraft,
  resetDraft,
  flushDraftToDrust,
} from '../onboarding-draft';
import * as profileApi from '@/api/profile';
import * as uiStore from '@/store/ui';

const mockedProfile = profileApi as unknown as {
  signOath: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
};
const mockedUi = uiStore as unknown as {
  setChallengeStartedAt: ReturnType<typeof vi.fn>;
};

describe('onboarding-draft store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDraft();
  });

  it('starts empty with every field nulled out', () => {
    const d = $onboardingDraft.get();
    expect(d.oath_signed).toBe(false);
    expect(d.diet_type).toBeNull();
    expect(d.pet_name).toBeNull();
  });

  it('patchDraft merges fields without nuking the rest', () => {
    patchDraft({ pet_name: '小綠' });
    patchDraft({ diet_type: 'vegan' });
    const d = $onboardingDraft.get();
    expect(d.pet_name).toBe('小綠');
    expect(d.diet_type).toBe('vegan');
  });

  it('flushDraftToDrust pushes oath, profile fields, and challenge_started_at then resets', async () => {
    patchDraft({
      oath_signed: true,
      diet_type: 'vegan',
      challenge_level: 2,
      purpose: 'environment',
      pet_name: '小綠',
    });

    await flushDraftToDrust(42);

    expect(mockedProfile.signOath).toHaveBeenCalledWith(42);
    expect(mockedProfile.updateProfile).toHaveBeenCalledWith(42, {
      diet_type: 'vegan',
      challenge_level: 2,
      purpose: 'environment',
    });
    expect(mockedUi.setChallengeStartedAt).toHaveBeenCalledWith(42);

    // Draft should be cleared after flush so subsequent registrations start fresh.
    expect($onboardingDraft.get().diet_type).toBeNull();
    expect($onboardingDraft.get().pet_name).toBeNull();
  });

  it('skips signOath when oath_signed is false', async () => {
    patchDraft({ diet_type: 'vegan' });
    await flushDraftToDrust(42);
    expect(mockedProfile.signOath).not.toHaveBeenCalled();
    expect(mockedProfile.updateProfile).toHaveBeenCalled();
  });

  it('skips updateProfile when no profile fields were set', async () => {
    patchDraft({ oath_signed: true });
    await flushDraftToDrust(42);
    expect(mockedProfile.signOath).toHaveBeenCalled();
    expect(mockedProfile.updateProfile).not.toHaveBeenCalled();
    expect(mockedUi.setChallengeStartedAt).toHaveBeenCalled();
  });

  it('keeps flushing the rest even if signOath rejects', async () => {
    mockedProfile.signOath.mockRejectedValueOnce(new Error('drust down'));
    patchDraft({ oath_signed: true, diet_type: 'vegan' });
    await flushDraftToDrust(42);
    expect(mockedProfile.updateProfile).toHaveBeenCalled();
    expect(mockedUi.setChallengeStartedAt).toHaveBeenCalled();
  });
});
