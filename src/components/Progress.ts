/**
 * Onboarding progress dots — N segments, the first M filled with `.done`.
 *
 * Used at the top of every onboarding screen so users see how far they have
 * walked through the setup flow (1/6, 2/6, ...).
 */
export function createProgress(current: number, total: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'onb-progress';
  for (let i = 1; i <= total; i++) {
    const dot = document.createElement('span');
    dot.className = 'onb-progress-dot' + (i <= current ? ' done' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}
