export type AdaptReason = 'pain' | 'technique' | 'hard' | 'incomplete' | 'recovery' | 'returning' | 'lighter' | 'fuel' | 'water' | 'more_data' | 'progress' | 'steady';
export type Performance = { pct: number | null; difficulty?: string; technique?: string; pain?: boolean; nextPreference?: string; stopReason?: string };
export type WeekCheck = { energy: number; sleep: number; soreness: number; preference: 'lighter' | 'same' | 'harder'; minutes: 10 | 20 | 30 | 45 };
/** Small bounded adjustments, not a diagnosis. A repeated read cannot compound the change. */
export function assessTraining(input: { baseStep: number; planned: number; sessions: Performance[]; screened: boolean; painReported?: boolean; readinessLow?: boolean; daysAway?: number; fuelLow?: boolean; waterLow?: boolean; review?: WeekCheck | null }) {
  const { sessions: ss, review: r } = input;
  const reasons: AdaptReason[] = [];
  const avg = ss.length ? Math.round(ss.reduce((n, s) => n + (s.pct ?? 0), 0) / ss.length) : null;
  if (input.painReported || ss.some(s => s.pain || s.stopReason === 'pain')) reasons.push('pain');
  if (ss.some(s => s.technique === 'needs_work' || s.stopReason === 'unclear')) reasons.push('technique');
  if (ss.some(s => s.difficulty === 'too_hard' || s.nextPreference === 'easier' || s.stopReason === 'too_hard')) reasons.push('hard');
  if (ss.some(s => s.pct !== null && s.pct < 60 && !['time', 'later'].includes(s.stopReason ?? ''))) reasons.push('incomplete');
  if (input.readinessLow || (r && (r.energy <= 2 || r.sleep <= 2 || r.soreness >= 4))) reasons.push('recovery');
  if ((input.daysAway ?? 0) >= 7) reasons.push('returning');
  if (r?.preference === 'lighter') reasons.push('lighter');
  const lower = reasons.length > 0;
  if (input.fuelLow) reasons.push('fuel');
  if (input.waterLow) reasons.push('water');
  const good = ss.filter(s => s.pct !== null && s.pct >= 90 && s.technique === 'good' && !s.pain && s.difficulty !== 'too_hard');
  const enough = good.length >= 2 && ss.length >= Math.ceil(input.planned * .75);
  const wantsMore = r?.preference === 'harder' || ss.some(s => s.difficulty === 'too_easy' || s.nextPreference === 'harder');
  const up = !lower && !reasons.length && enough && wantsMore && !input.screened;
  if (!lower && !up && !reasons.length) reasons.push(wantsMore && !enough ? 'more_data' : 'steady');
  if (up) reasons.push('progress');
  const step = Math.max(0, Math.min(input.screened ? 3 : 8, input.baseStep + (lower ? -1 : up ? 1 : 0)));
  return { step, change: step < input.baseStep ? 'down' as const : step > input.baseStep ? 'up' as const : 'same' as const, reasons, avg, completed: ss.length, planned: input.planned, reviewed: ss.filter(s => s.technique && s.technique !== 'unknown').length };
}
