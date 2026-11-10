"""Single-instance, CPU-only POC. Stop this app before redeploying SQLite changes."""
from pathlib import Path
import modal

ROOT = Path(__file__).resolve().parents[2] if modal.is_local() else Path('/app')
app = modal.App('myanmar-fitness-coach')
volume = modal.Volume.from_name('myanmar-fitness-coach-data', create_if_missing=True, version=2)
config = modal.Secret.from_name('myanmar-fitness-coach-config', required_keys=['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'])

def ignored(path):
    relative = Path(path)
    if relative.is_absolute(): relative = relative.relative_to(ROOT)
    return any(part in {'.git', 'node_modules', '.next', '__pycache__', 'myanmar-fitness-coach', '.setup-unused'} for part in relative.parts) or Path(path).name.startswith('.env') or str(path).endswith(('.db', '.tsbuildinfo'))

image = (modal.Image.from_registry('node:22-bookworm-slim', add_python='3.12')
    .apt_install('openssl').workdir('/app')
    .env({'NEXT_TELEMETRY_DISABLED': '1'})
    .add_local_dir(ROOT, '/app', copy=True, ignore=ignored)
    .run_commands('npm ci --no-audit --no-fund',
        'DATABASE_URL=file:/tmp/build.db BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build-only-placeholder-secret-not-for-runtime npm run build'))

@app.function(image=image, volumes={'/data': volume}, secrets=[config], cpu=2, memory=4096,
              min_containers=0, max_containers=1, scaledown_window=180, timeout=600)
@modal.concurrent(max_inputs=1)
@modal.web_server(3000, startup_timeout=180, label='myanmar-fitness-coach')
def web():
    import os
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
    subprocess.run(['npm', 'run', 'db:migrate'], cwd='/app', check=True)
    subprocess.run(['npm', 'run', 'db:seed'], cwd='/app', check=True)
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
