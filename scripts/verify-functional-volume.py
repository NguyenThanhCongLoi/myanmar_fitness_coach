"""Read-only verification of the existing Modal POC, including preservation against its release backup."""
import hashlib
import json
import os
from pathlib import Path
import modal

product=Path(os.environ.get('FITNESS_SOURCE_DIR',Path(__file__).resolve().parents[1]))
digest=hashlib.sha256()
for source in [product/'prisma/seed.ts',*sorted((product/'prisma').glob('*.json'))]:
    digest.update(source.name.encode());digest.update(source.read_bytes())
app=modal.App.lookup('myanmar-fitness-coach-maint',environment_name='main')
volume=modal.Volume.from_name('myanmar-fitness-coach-data',environment_name='main').with_mount_options(read_only=True)
sb=modal.Sandbox.create('sleep','120',app=app,image=modal.Image.debian_slim(python_version='3.12'),volumes={'/data':volume},timeout=120,cpu=.25,memory=256)
try:
    code='''import json,pathlib,sqlite3,sys
c=sqlite3.connect('file:/data/fitness.db?mode=ro',uri=True)
b=sqlite3.connect('file:/data/backups/pre-functional-v1.db?mode=ro',uri=True)
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert b.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert pathlib.Path('/data/catalog-seed.sha256').read_text().strip()==sys.argv[1]
preserved={}
for table in ['user','FitnessProfile','WorkoutSession','WorkoutSet','BodyMeasurement']:
    previous={r[0] for r in b.execute('SELECT id FROM '+table)}
    current={r[0] for r in c.execute('SELECT id FROM '+table)}
    assert previous<=current,table+' records missing'
    preserved[table]={'before':len(previous),'after':len(current),'idsPreserved':True}
assert c.execute('SELECT count(*) FROM Exercise').fetchone()[0]==73
plank=c.execute("SELECT name,tags FROM Exercise WHERE id='curated-plank'").fetchone()
assert plank[0]=='High plank' and 'wrist-loaded' in json.loads(plank[1])
print(json.dumps({'result':'PASS','integrity':'ok','backup':'/data/backups/pre-functional-v1.db','backupIntegrity':'ok','seedStampMatchesSource':True,'exercises':73,'highPlankMapping':True,'preserved':preserved,'mount':'separate read-only maintenance container'}))
'''
    p=sb.exec('python','-c',code,digest.hexdigest());out=p.stdout.read();p.wait()
    if p.returncode:raise RuntimeError(out+p.stderr.read())
    output=Path(os.environ.get('FITNESS_VOLUME_RESULT',product/'evidence/functional-review/volume.json'))
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(out,encoding='utf-8');print(out,end='')
finally:
    sb.terminate(wait=True)
