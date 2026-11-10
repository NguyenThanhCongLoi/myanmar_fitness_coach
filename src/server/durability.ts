export async function persistDatabase() {
  if (process.env.PERSISTENCE_MODE === 'test') return;
  const secret = process.env.VOLUME_COMMIT_TOKEN;
  if (!secret) throw new Error('Persistent storage bridge is not configured');
  const response = await fetch('http://127.0.0.1:9988/commit', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Persistent storage commit failed');
}
