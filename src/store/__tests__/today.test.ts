import { describe, it, expect, beforeEach } from 'vitest';
import type { ChallengeScript } from '@/api/content';
import { $today, $challenge, markMissionDone, setDay } from '../today';

const mkScript = (n: number, color: string): ChallengeScript => ({
  id: n,
  day_number: n,
  lucky_color: color,
  greeting: '',
  action_type: '',
  task_description: '',
  bonus_challenge: '',
  fog_reduction_pct: 0,
});

describe('today store', () => {
  beforeEach(() => {
    $today.set({ dayNumber: 1, totalXpToday: 0, missionsDone: [], luckyColor: '' });
    $challenge.set({ scripts: [], currentDay: null });
  });

  it('starts with sensible defaults', () => {
    expect($today.get()).toEqual({
      dayNumber: 1,
      totalXpToday: 0,
      missionsDone: [],
      luckyColor: '',
    });
    expect($challenge.get()).toEqual({ scripts: [], currentDay: null });
  });

  it('markMissionDone adds key and increments xp', () => {
    markMissionDone('check-in', 30);
    expect($today.get().missionsDone).toEqual(['check-in']);
    expect($today.get().totalXpToday).toBe(30);
  });

  it('markMissionDone is idempotent for same key', () => {
    markMissionDone('check-in', 30);
    markMissionDone('check-in', 50);
    expect($today.get().missionsDone).toEqual(['check-in']);
    expect($today.get().totalXpToday).toBe(30);
  });

  it('markMissionDone allows multiple distinct keys', () => {
    markMissionDone('check-in', 30);
    markMissionDone('quiz', 20);
    expect($today.get().missionsDone).toEqual(['check-in', 'quiz']);
    expect($today.get().totalXpToday).toBe(50);
  });

  it('setDay loads correct script and resets day state', () => {
    const scripts = [mkScript(1, 'red'), mkScript(2, 'blue'), mkScript(3, 'green')];
    setDay(scripts, 2);
    expect($challenge.get().scripts).toBe(scripts);
    expect($challenge.get().currentDay?.day_number).toBe(2);
    expect($today.get()).toEqual({
      dayNumber: 2,
      totalXpToday: 0,
      missionsDone: [],
      luckyColor: 'blue',
    });
  });

  it('setDay handles unknown day with empty luckyColor', () => {
    setDay([mkScript(1, 'red')], 5);
    expect($challenge.get().currentDay).toBeNull();
    expect($today.get().luckyColor).toBe('');
  });
});
