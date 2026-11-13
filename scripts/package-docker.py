"""Package the current working tree without secrets, caches or runtime databases."""
from datetime import datetime, timezone
import json
import hashlib
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]
out = root.parent / 'evidence' / 'docker-deployment'
out.mkdir(parents=True, exist_ok=True)
release = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
files = subprocess.check_output([
    'git', '-c', 'safe.directory=' + root.as_posix(),
    'ls-files', '--cached', '--others', '--exclude-standard', '-z',
], cwd=root).decode().split('\0')
archive = out / ('source-' + release + '.tar.gz')
selected = []
with tarfile.open(archive, 'w:gz', compresslevel=1) as tar:
    for name in sorted(set(files)):
        path = PurePosixPath(name)
        if not name or not (root / name).is_file():
            continue
        if path.parts[0] in {'docs', 'evidence', '.github'} or path.name.startswith('.env'):
            continue
        if any(part in {'.git', 'node_modules', '.next', '.playwright-cli', '__pycache__'} for part in path.parts):
            continue
        if path.suffix in {'.db', '.tsbuildinfo', '.env', '.pem', '.key', '.ppk'} or '.db-' in path.name:
            continue
        tar.add(root / name, arcname=name, recursive=False)
        selected.append(name)
assert 'Dockerfile' in selected
commit = subprocess.check_output(['git', '-c', 'safe.directory=' + root.as_posix(), 'rev-parse', 'HEAD'], cwd=root).decode().strip()
metadata = {'release': release, 'files': len(selected), 'archive': str(archive),
            'baseCommit': commit, 'archiveSha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest(),
            'remote': '/home/github-runner/fitness-deployment/releases/' + release}
(out / 'release.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print(json.dumps(metadata), flush=True)
print('Archive bytes:', archive.stat().st_size, flush=True)
