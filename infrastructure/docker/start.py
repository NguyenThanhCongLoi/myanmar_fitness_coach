"""Single writer on a local durable bind mount; retain the app's commit contract."""
import hashlib
import hmac
import os
from pathlib import Path
import secrets
import signal
import sqlite3
import subprocess
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

DATA = Path('/data')
DB = DATA / 'fitness.db'


def sync_storage():
    # SQLite commits first. Explicitly sync the DB and directory before the API
    # acknowledges the write, including the DELETE-journal directory entry.
    for path, flags in [(DB, os.O_RDONLY), (DATA, os.O_RDONLY | os.O_DIRECTORY)]:
        fd = os.open(path, flags)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def main():
    if os.environ.get('DATABASE_URL') != 'file:/data/fitness.db':
        raise RuntimeError('Docker requires the persistent /data/fitness.db path')
    if not os.environ.get('BETTER_AUTH_SECRET') or not os.environ.get('BETTER_AUTH_URL'):
        raise RuntimeError('Configure authentication before starting')
    os.environ.pop('PERSISTENCE_MODE', None)
    DATA.mkdir(exist_ok=True)
    # A process-lifetime exclusive lock prevents accidental duplicate web writers.
    import fcntl
    lock = (DATA / 'web-writer.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    with sqlite3.connect(DB) as connection:
        if connection.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]:
            backups = DATA / 'backups'
            backups.mkdir(exist_ok=True)
            name = datetime.now(timezone.utc).strftime('pre-start-%Y%m%dT%H%M%S%fZ.db')
            with sqlite3.connect(backups / name) as backup:
                connection.backup(backup)
                if backup.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Pre-start backup failed integrity check')
        connection.execute('PRAGMA journal_mode=DELETE')
        connection.execute('PRAGMA synchronous=EXTRA')
    subprocess.run(['npm', 'run', 'db:migrate'], check=True)
    digest = hashlib.sha256()
    for source in [Path('prisma/seed.ts'), *sorted(Path('prisma').glob('*.json'))]:
        digest.update(source.name.encode())
        digest.update(source.read_bytes())
    stamp = DATA / 'catalog-seed.sha256'
    if not stamp.exists() or stamp.read_text().strip() != digest.hexdigest():
        subprocess.run(['npm', 'run', 'db:seed'], check=True)
        stamp.write_text(digest.hexdigest())
    sync_storage()
    token = secrets.token_urlsafe(32)
    os.environ['VOLUME_COMMIT_TOKEN'] = token

    class CommitHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != '/commit' or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                self.send_error(403)
                return
            try:
                sync_storage()
                self.send_response(204)
                self.end_headers()
            except OSError:
                self.send_error(503)

        def log_message(self, *_):
            pass

    bridge = HTTPServer(('127.0.0.1', 9988), CommitHandler)
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    child = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3000'])
    def stop(*_):
        child.terminate()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        raise SystemExit(child.wait())
    finally:
        bridge.shutdown()
        lock.close()


if __name__ == '__main__':
    main()
