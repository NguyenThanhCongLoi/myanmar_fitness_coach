"""Single-instance, CPU-only POC. Stop this app before redeploying SQLite changes."""
from pathlib import Path
import modal

ROOT = Path(__file__).resolve().parents[2] if modal.is_local() else Path('/app')
app = modal.App('myanmar-fitness-coach')
volume = modal.Volume.from_name('myanmar-fitness-coach-data', create_if_missing=True, version=2)
config = modal.Secret.from_name('myanmar-fitness-coach-config', required_keys=['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'])
# Upload only integration variables; never overwrite stable auth settings.
gateway_values = {}
if modal.is_local():
    from dotenv import dotenv_values
    local_values = dotenv_values(ROOT / '.env', interpolate=False, encoding='utf-8-sig')
    gateway_values = {key: local_values.get(key) or '' for key in ('LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TTS_BASE_URL', 'TTS_API_KEY', 'TTS_MODEL', 'TTS_VOICE', 'TTS_EN_BASE_URL', 'TTS_EN_API_KEY', 'TTS_EN_MODEL', 'TTS_EN_VOICE', 'ADMIN_EMAILS')}
    llm_values = [gateway_values[key] for key in ('LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL')]
    if any(llm_values) and not all(value.strip() for value in llm_values):
        raise ValueError('Fill all three LLM_* variables in myanmar-fitness-coach/.env, or leave all three blank.')
    google_values = [gateway_values[key] for key in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')]
    if any(google_values) and not all(value.strip() for value in google_values):
        raise ValueError('Fill both GOOGLE_* variables in myanmar-fitness-coach/.env, or leave both blank.')
gateway = modal.Secret.from_dict(gateway_values)
notification_config=modal.Secret.from_name('myanmar-fitness-coach-notifications',required_keys=['NOTIFICATION_CRON_TOKEN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'])

def ignored(path):
    relative = Path(path)
    if relative.is_absolute(): relative = relative.relative_to(ROOT)
    return any(part in {'.git', 'node_modules', '.next', '__pycache__', 'myanmar-fitness-coach', '.setup-unused'} for part in relative.parts) or Path(path).name.startswith('.env') or str(path).endswith(('.db', '.tsbuildinfo'))

image = (modal.Image.from_registry('node:22-bookworm-slim', add_python='3.12')
    .apt_install('openssl').workdir('/app')
    .env({'NEXT_TELEMETRY_DISABLED': '1', 'VOICE_WARMUP': '0'})
    .add_local_dir(ROOT, '/app', copy=True, ignore=ignored)
    .run_commands('npm ci --no-audit --no-fund',
        'DATABASE_URL=file:/tmp/build.db BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build-only-placeholder-secret-not-for-runtime npm run build'))

@app.function(image=image, volumes={'/data': volume}, secrets=[config, gateway,notification_config], cpu=2, memory=4096,
              min_containers=0, max_containers=1, scaledown_window=300, timeout=600)
@modal.concurrent(max_inputs=1)
@modal.web_server(3000, startup_timeout=180, label='myanmar-fitness-coach')
def web():
    import os
    import hashlib
    import secrets
    import sqlite3
    import subprocess
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
    token = secrets.token_urlsafe(32)
    os.environ.update(DATABASE_URL='file:/data/fitness.db', VOLUME_COMMIT_TOKEN=token)
    os.environ.pop('PERSISTENCE_MODE', None)
    # DELETE journals and exactly one writer: no distributed SQLite locking assumptions.
    with sqlite3.connect('/data/fitness.db') as connection:
        connection.execute('PRAGMA journal_mode=DELETE')
        connection.execute('PRAGMA busy_timeout=30000')
        # Capture the existing database before this release's additive migrations.
        adaptive_backup = Path('/data/backups/pre-adaptive-v2.db')
        if connection.execute("SELECT count(*) FROM sqlite_master WHERE name='WorkoutSession'").fetchone()[0] and not adaptive_backup.exists():
            adaptive_backup.parent.mkdir(exist_ok=True)
            with sqlite3.connect(adaptive_backup) as backup:
                connection.backup(backup)
            volume.commit()
        if connection.execute("SELECT count(*) FROM sqlite_master WHERE name='WorkoutSession'").fetchone()[0] and not connection.execute("SELECT count(*) FROM sqlite_master WHERE name='GameState'").fetchone()[0]:
            backup_path=Path('/data/backups/pre-gamification.db')
            backup_path.parent.mkdir(exist_ok=True)
            if not backup_path.exists():
                with sqlite3.connect(backup_path) as backup:
                    connection.backup(backup)
                volume.commit()
    subprocess.run(['npm', 'run', 'db:migrate'], cwd='/app', check=True)
    # Seed only when curated source changes. Customer records are never part of this hash.
    digest = hashlib.sha256()
    for source in [Path('/app/prisma/seed.ts'), *sorted(Path('/app/prisma').glob('*.json'))]:
        digest.update(source.name.encode())
        digest.update(source.read_bytes())
    seed_version = digest.hexdigest()
    seed_stamp = Path('/data/catalog-seed.sha256')
    if not seed_stamp.exists() or seed_stamp.read_text().strip() != seed_version:
        subprocess.run(['npm', 'run', 'db:seed'], cwd='/app', check=True)
        seed_stamp.write_text(seed_version)
    else:
        print('Curated catalog unchanged; skipping seed.', flush=True)
    volume.commit()
    class CommitHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != '/commit' or self.headers.get('Authorization') != 'Bearer ' + token:
                self.send_error(403); return
            try:
                volume.commit()
                self.send_response(204); self.end_headers()
            except Exception:
                self.send_error(503)
        def log_message(self, *_): pass
    bridge = HTTPServer(('127.0.0.1', 9988), CommitHandler)
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    subprocess.Popen(['npm', 'run', 'start'], cwd='/app', env=os.environ.copy())

# No Volume here: all SQLite access stays inside the single web container.
@app.function(image=modal.Image.debian_slim(python_version='3.12'),secrets=[notification_config,config],
              schedule=modal.Period(minutes=60),cpu=0.25,memory=256,max_containers=1,timeout=600)
def check_notifications():
    import os
    import urllib.request
    request=urllib.request.Request(os.environ['BETTER_AUTH_URL'].rstrip('/')+'/api/internal/notifications',
        method='POST',data=b'{}',headers={'Authorization':'Bearer '+os.environ['NOTIFICATION_CRON_TOKEN'],'Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=540) as response:
        if response.status!=200: raise RuntimeError('Notification check failed')
