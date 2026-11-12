// Runs once when the Next.js server starts. Deploy-time warm-up of fixed voice audio (opt-in via VOICE_WARMUP=1).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VOICE_WARMUP !== '1') return;
  setTimeout(() => {
    import('./server/tts').then(m => m.warmVoices(msg => console.log(msg))).catch(() => console.log('voice warm-up skipped'));
  }, 15000);
}
