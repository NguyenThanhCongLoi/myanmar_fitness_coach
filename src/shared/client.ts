export class RequestError extends Error { constructor(public code: string, public status: number) { super(code); } }
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch('/api/fitness/' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new RequestError(body.error ?? 'REQUEST_FAILED', response.status);
  return body;
}
export function localExercise(exercise: import('./types').Exercise, locale: string) {
  const translation = exercise.translations.find(item => item.locale === locale);
  return { name: translation?.name ?? exercise.name, instructions: translation?.instructions ?? exercise.instructions };
}
export function weightValue(kg: number, unit: string) { return unit === 'lb' ? kg / 0.45359237 : kg; }
