"""Explicit SSH deployment phases. Secrets travel over stdin, never command arguments."""
import argparse
import base64
import json
from pathlib import Path
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT.parent / 'evidence/docker-deployment/release.json'
HOST = 'myanmar-prod'


def remote(command, **kwargs):
    return subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', HOST, command], check=True, **kwargs)


def python_remote(code, payload):
    encoded = base64.b64encode(code.encode()).decode()
    remote('python3 -c ' + shlex.quote("import base64;exec(base64.b64decode('" + encoded + "'))"),
           input=json.dumps(payload).encode())


parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['stage', 'build', 'configure', 'up', 'status'])
parser.add_argument('--debian-mirror', help='Optional signed Debian archive mirror for restricted server egress')
args = parser.parse_args()
if args.action == 'stage':
    subprocess.run(['python', str(ROOT / 'scripts/package-docker.py')], check=True)
state = json.loads(STATE.read_text(encoding='utf-8'))
release = state['release']
if not release.isalnum():
    raise SystemExit('Invalid release identifier')
directory = '/home/github-runner/fitness-deployment/releases/' + release
image = 'mingalar-fitness:' + release
compose = 'FITNESS_RELEASE=' + release + ' docker compose -p mingalar-fitness -f ' + directory + '/infrastructure/docker/compose.yaml '
if args.action == 'stage':
    remote('umask 077; mkdir -p ' + directory)
    subprocess.run(['scp', '-o', 'BatchMode=yes', state['archive'], HOST + ':' + directory + '/source.tar.gz'], check=True)
    remote('cd ' + directory + ' && printf ' + shlex.quote(state['archiveSha256'] + '  source.tar.gz\n') + ' | sha256sum -c - && tar -xzf source.tar.gz && rm source.tar.gz')
elif args.action == 'build':
    option = ' --build-arg ' + shlex.quote('DEBIAN_MIRROR=' + args.debian_mirror) if args.debian_mirror else ''
    remote('cd ' + directory + ' && docker build' + option + ' --target verification -t ' + image + '-verified . && docker build' + option + ' --target runtime -t ' + image + ' .')
elif args.action == 'configure':
    result = subprocess.run(['node', '-e', "const fs=require('node:fs');process.stdout.write(JSON.stringify(require('node:util').parseEnv(fs.readFileSync('.env','utf8'))))"],
                            cwd=ROOT, check=True, capture_output=True)
    values = json.loads(result.stdout)
    allowed = {'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
               'TTS_BASE_URL', 'TTS_API_KEY', 'TTS_VOICE', 'TTS_MODEL', 'TTS_EN_BASE_URL', 'TTS_EN_API_KEY',
               'TTS_EN_VOICE', 'TTS_EN_MODEL', 'ADMIN_EMAILS', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'}
    selected = {key: value for key, value in values.items() if key in allowed}
    python_remote('''
import json,os,pathlib,secrets,subprocess,sys
from datetime import datetime,timezone
payload=json.load(sys.stdin)
root=pathlib.Path('/home/github-runner/fitness-deployment')
root.mkdir(exist_ok=True,mode=0o700)
os.chmod(root,0o700)
env=root/'runtime.env'
old={}
if env.exists():
 for line in env.read_text().splitlines():
  if '=' in line:
   key,value=line.split('=',1);old[key]=value
 backup=root/'config-backups';backup.mkdir(exist_ok=True,mode=0o700)
 target=backup/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.env')
 target.write_bytes(env.read_bytes());os.chmod(target,0o600)
values=payload['values']
values.update(BETTER_AUTH_URL='https://fitness.aibinhdan.vn',DATABASE_URL='file:/data/fitness.db',VOICE_WARMUP='0',
 BETTER_AUTH_SECRET=old.get('BETTER_AUTH_SECRET') or secrets.token_urlsafe(48),
 NOTIFICATION_CRON_TOKEN=old.get('NOTIFICATION_CRON_TOKEN') or secrets.token_urlsafe(48))
if not values.get('VAPID_PUBLIC_KEY') or not values.get('VAPID_PRIVATE_KEY'):
 if old.get('VAPID_PUBLIC_KEY') and old.get('VAPID_PRIVATE_KEY'):
  values.update({k:old[k] for k in ('VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY')})
 else:
  keys=json.loads(subprocess.check_output(['docker','run','--rm','--entrypoint','node',payload['image'],'-e',"process.stdout.write(JSON.stringify(require('web-push').generateVAPIDKeys()))"]))
  values.update(VAPID_PUBLIC_KEY=keys['publicKey'],VAPID_PRIVATE_KEY=keys['privateKey'])
for value in values.values():
 if '\\n' in value or '\\r' in value:raise RuntimeError('Multiline env values require explicit handling')
for name,data in [('runtime.env',values),('scheduler.env',{'NOTIFICATION_CRON_TOKEN':values['NOTIFICATION_CRON_TOKEN']})]:
 path=root/(name+'.tmp')
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:
  f.write(''.join(key+'='+value+'\\n' for key,value in sorted(data.items())));f.flush();os.fsync(f.fileno())
 os.chmod(path,0o600)
 os.replace(path,root/name)
(root/'data').mkdir(exist_ok=True,mode=0o700)
fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY)
try:os.fsync(fd)
finally:os.close(fd)
print('Private runtime env installed; values suppressed. Database contents unchanged.')
''', {'values': selected, 'image': image})
elif args.action == 'up':
    # Do not overlap two releases that share SQLite. Stop only this Compose project.
    remote(compose + 'config --quiet && ' + compose + 'stop && ' + compose + 'up -d --no-build --wait --wait-timeout 240 && ln -sfn releases/' + release + ' /home/github-runner/fitness-deployment/current')
elif args.action == 'status':
    remote(compose + 'ps')
