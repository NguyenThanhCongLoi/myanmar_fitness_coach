// Planning estimate only. A rep-based set always needs explicit completion.
export const REP_SECONDS_ESTIMATE = 3;
export function estimatedSetSeconds(reps: number, perSide = false) {
  return Math.max(0, Math.round(reps * REP_SECONDS_ESTIMATE * (perSide ? 2 : 1)));
}
export function countdownRemaining(seconds: number, elapsed: number) {
  return Math.max(0, seconds - Math.max(0, elapsed));
}
export function consumeActiveTime(remainderMs:number,deltaMs:number) {
  const total=Math.max(0,remainderMs)+Math.max(0,deltaMs);
  const seconds=Math.floor(total/1000);
  return {seconds,remainderMs:total-seconds*1000};
}
/** Small bounded fatigue/transition allowance; base rest comes from profile and movement. */
export function blockRest(base: number, setIndex: number, timed: boolean, changesExercise: boolean, newRound = false) {
  return Math.min(600, Math.max(10, base) + Math.min(30, Math.floor(setIndex / (timed ? 2 : 1)) * 5)
    + (changesExercise ? 10 : 0) + (newRound ? 10 : 0));
}
