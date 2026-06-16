/**
 * Milestone questionnaires — small, modal-style surveys that fire after
 * the user crosses certain streak milestones (day 2, 8, 16, 31, …).
 *
 * A milestone is a SET of questions shown together in one popup with a
 * single submit. The user answers all questions in that milestone in
 * one sitting; once submitted (or skipped) the milestone is recorded
 * and never re-shown. The trigger fires on /home mount after we know
 * the user's day count, so the survey appears the next time they land
 * on home after the qualifying check-in — not on top of the success
 * celebration.
 *
 * Bilingual strings live inline here rather than in lib/i18n.ts to
 * keep the survey copy in one editable place. Future hookup point:
 * persist answers to drust so they survive a device swap; for now
 * localStorage is enough.
 */
import { KEYS, storage } from '@/lib/storage';

export interface LocalizedString {
  zh: string;
  en: string;
}

export interface QuestionOption {
  id: string;
  label: LocalizedString;
  /** When picked, reveals a free-text field for elaboration. */
  needsFreeText?: boolean;
}

export interface Question {
  /** Stable id used as the per-question answer key. */
  id: string;
  /** Short label shown above the prompt (e.g. "第一題"). */
  label: LocalizedString;
  prompt: LocalizedString;
  options: QuestionOption[];
}

export interface Milestone {
  /** Stable id used as the storage key for the whole session. */
  id: string;
  /** Fires when (count of distinct days with a check-in) >= triggerDay. */
  triggerDay: number;
  title: LocalizedString;
  questions: Question[];
}

export interface StoredAnswer {
  optionId: string;
  freeText?: string;
}

export interface StoredMilestone {
  /** questionId → user's pick. Empty until the user submits. */
  answers: Record<string, StoredAnswer>;
  answeredAt: number;
  /** True if the user picked "Maybe later" / closed the popup without
   *  answering. Deferred milestones don't auto-popup again but DO
   *  surface as a card on the pet page (= /home) so the user can
   *  come back to them. */
  deferred?: boolean;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'day2',
    triggerDay: 2,
    title: { zh: 'Day 2 問卷', en: 'Day 2 Survey' },
    questions: [
      {
        id: 'day2-intro',
        label: { zh: '第一題', en: 'Question 1' },
        prompt: { zh: '你目前是？（單選）', en: 'Which best describes you? (single choice)' },
        options: [
          { id: 'first-try',    label: { zh: '第一次嘗試、好奇來看看', en: 'First try — just curious' } },
          { id: 'religious',    label: { zh: '因為宗教因素接觸過（初一十五、節慶等）', en: 'Religious occasions (1st/15th, festivals…)' } },
          { id: 'health-eco',   label: { zh: '之前因健康 / 環保短暫嘗試過、想找方法持續', en: 'Tried briefly for health / sustainability — looking for a way to keep going' } },
          { id: 'long-term',    label: { zh: '我已經是長期蔬食者、想記錄生活', en: "I'm already a long-term plant-based eater — here to log it" } },
          { id: 'other',        label: { zh: '其他', en: 'Other' }, needsFreeText: true },
        ],
      },
      {
        id: 'day2-curiosity',
        label: { zh: '第二題', en: 'Question 2' },
        prompt: {
          zh: '關於蔬食、你最好奇 / 想了解的是？（單選）',
          en: 'About a plant-based lifestyle, what are you most curious about? (single choice)',
        },
        options: [
          { id: 'nutrition',    label: { zh: '蔬食怎麼吃才營養均衡', en: 'How to eat plant-based with balanced nutrition' } },
          { id: 'restaurants',  label: { zh: '哪裡可以找到好吃的蔬食店家', en: 'Where to find great plant-based restaurants' } },
          { id: 'home-cooking', label: { zh: '在家怎麼煮簡單的蔬食', en: 'How to cook simple plant-based meals at home' } },
          { id: 'environment',  label: { zh: '蔬食對環境的影響有多大', en: 'How much plant-based eating impacts the environment' } },
          { id: 'advocacy',     label: { zh: '怎麼跟身邊人介紹蔬食', en: 'How to introduce plant-based eating to people around me' } },
          { id: 'sharer',       label: { zh: '我已經夠了解了、想成為分享者', en: "I know enough — I want to share it with others" } },
        ],
      },
    ],
  },
];

function readAll(): Record<string, StoredMilestone> {
  const raw = storage.get<unknown>(KEYS.QUESTIONNAIRE_ANSWERS, {});
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, StoredMilestone>;
}

function writeAll(next: Record<string, StoredMilestone>): void {
  storage.set(KEYS.QUESTIONNAIRE_ANSWERS, next);
}

/** Earliest fully-untouched milestone whose trigger has fired. These
 *  pop up automatically on /home. Deferred and answered milestones
 *  are excluded — the former show as a card, the latter never
 *  resurface. */
export function findPendingMilestone(daysWithCheckIn: number): Milestone | null {
  const done = readAll();
  const due = MILESTONES
    .filter((m) => m.triggerDay <= daysWithCheckIn && !done[m.id])
    .sort((a, b) => a.triggerDay - b.triggerDay);
  return due[0] ?? null;
}

/** Earliest milestone the user touched but did not submit (i.e. no
 *  recorded answers). Surfaces as a tappable card on the pet page so
 *  the user can finish answering on their own time. We treat ANY
 *  entry without answers as deferred — that way old `skipped: true`
 *  shapes from earlier iterations still resurface instead of getting
 *  stuck in limbo. */
export function findDeferredMilestone(daysWithCheckIn: number): Milestone | null {
  const done = readAll();
  const due = MILESTONES
    .filter((m) => {
      if (m.triggerDay > daysWithCheckIn) return false;
      const entry = done[m.id];
      if (!entry) return false;
      return Object.keys(entry.answers ?? {}).length === 0;
    })
    .sort((a, b) => a.triggerDay - b.triggerDay);
  return due[0] ?? null;
}

export function recordMilestoneAnswers(
  milestoneId: string,
  answers: Record<string, StoredAnswer>,
): void {
  const all = readAll();
  all[milestoneId] = { answers, answeredAt: Date.now() };
  writeAll(all);
}

export function markMilestoneDeferred(milestoneId: string): void {
  const all = readAll();
  all[milestoneId] = { answers: {}, answeredAt: Date.now(), deferred: true };
  writeAll(all);
}

/** Dev-only — wipe all stored answers so the popups fire again. */
export function clearAnswers(): void {
  storage.remove(KEYS.QUESTIONNAIRE_ANSWERS);
}
