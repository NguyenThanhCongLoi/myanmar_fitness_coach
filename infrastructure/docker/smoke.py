"""Run on the Docker host against a disposable DB; never accepts a public URL."""
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

image = sys.argv[1]
name = 'fitness-qa-' + secrets.token_hex(5)
source = Path(__file__).resolve().parents[2]
expected_ids = {entry['id'] for filename in ['exercises.json', 'exercise-catalog.json']
                for entry in json.loads((source / 'prisma' / filename).read_text())}


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, **kwargs)


with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
url = 'http://127.0.0.1:' + str(port)


def client():
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path, body=None, status=200):
        req = urllib.request.Request(url + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Origin': url, 'Content-Type': 'application/json'})
        try:
            with opener.open(req, timeout=30) as response:
                code, content = response.status, response.read()
        except urllib.error.HTTPError as error:
            code, content = error.code, error.read()
        assert code == status, (path, code)  # Never log cookies/passwords/responses.
        return json.loads(content) if content and path.startswith('/api/') else None
    return request


def ready():
    for _ in range(180):
        try:
            client()('/')
            return
        except (OSError, AssertionError):
            time.sleep(1)
    raise RuntimeError('Disposable runtime did not become ready')


with tempfile.TemporaryDirectory(prefix=name + '-') as directory:
    root = Path(directory)
    data = root / 'data'
    data.mkdir()
    env = root / 'runtime.env'
    env.write_text('DATABASE_URL=file:/data/fitness.db\nBETTER_AUTH_URL=' + url +
                   '\nBETTER_AUTH_SECRET=' + secrets.token_urlsafe(48) +
                   '\nNOTIFICATION_CRON_TOKEN=' + secrets.token_urlsafe(48) + '\nVOICE_WARMUP=0\nHOME=/tmp\n')
    env.chmod(0o600)
    options = ['--user', f'{os.getuid()}:{os.getgid()}', '--env-file', str(env), '-v', str(data) + ':/data']
    try:
        docker('run', '-d', '--name', name, '--init', '-p', f'127.0.0.1:{port}:3000', *options, image, stdout=subprocess.DEVNULL)
        ready()
        a, b = client(), client()
        for request, label in [(a, 'a'), (b, 'b')]:
            request('/api/auth/sign-up/email', {'name': 'Disposable QA ' + label,
                    'email': name + label + '@example.test', 'password': secrets.token_urlsafe(24)})
        profile = {'locale': 'my-MM', 'goal': 'general_fitness', 'experience': 'beginner',
                   'equipment': ['body weight'], 'daysPerWeek': 3, 'limitations': '',
                   'weightUnit': 'kg', 'distanceUnit': 'km', 'timezone': 'Asia/Yangon'}
        a('/api/fitness/profile', profile)
        exercises = a('/api/fitness/exercises')
        assert {entry['id'] for entry in exercises} == expected_ids, 'API catalog differs from the staged seed source'
        plan = a('/api/fitness/plans', {'name': 'Disposable persistence QA', 'goal': 'Build a habit', 'weeks': 1,
                 'days': [{'name': 'Day 1', 'week': 1, 'weekday': 0, 'exercises': [{'exerciseId': exercises[0]['id'],
                            'sets': 2, 'reps': 10, 'restSeconds': 60, 'targetKg': 0}]}]})
        assert b('/api/fitness/plans') == []
        b('/api/fitness/sessions', {'dayId': plan['days'][0]['id']}, 404)
        client()('/api/fitness/bootstrap', status=401)
        client()('/api/internal/notifications', {}, 401)
        probe = subprocess.run(['docker', 'run', '--rm', *options, image], capture_output=True, timeout=45)
        assert probe.returncode != 0 and b'BlockingIOError' in probe.stderr, 'Second writer was not rejected'
        docker('restart', name, stdout=subprocess.DEVNULL)
        ready()
        assert any(item['id'] == plan['id'] for item in a('/api/fitness/plans'))
        assert b('/api/fitness/plans') == []
        docker('stop', name, stdout=subprocess.DEVNULL)
        import sqlite3
        with sqlite3.connect('file:' + str(data / 'fitness.db') + '?mode=ro', uri=True) as db:
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert db.execute('SELECT count(*) FROM User').fetchone()[0] == 2
        assert list((data / 'backups').glob('pre-start-*.db'))
        print(json.dumps({'result': 'PASS', 'image': image, 'exerciseCount': len(exercises), 'checks': ['fresh catalog matches seed source', 'signup', 'durable profile/plan',
              'owner isolation', 'anonymous 401', 'cron unauthorized 401', 'duplicate writer rejected',
              'restart retains account/session/plan', 'SQLite integrity', 'pre-start backup']}), flush=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
