"""Audit local registered assets, without downloading third-party media. ffprobe is optional."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((root / 'prisma' / name).read_text(encoding='utf-8'))
catalog = load('exercise-catalog.json')
maps = [load(name) for name in ['exercise-media-original.json', 'exercise-media-wger.json', 'exercise-media.json']]
policy = (root / 'src/shared/exercise-place.ts').read_text(encoding='utf-8')
home = set(re.findall(r"'([^']+)'", policy.split('] as const')[0]))
rows = []
for e in catalog:
    media = next((m[e['id']] for m in maps if e['id'] in m), {})
    video = media.get('videoUrl') or e.get('videoUrl')
    poster = media.get('thumbnailUrl') or e.get('thumbnailUrl')
    place = 'home' if e['id'] in home and all(q == 'body weight' for q in e['equipment']) else 'gym' if e['id'] != 'curated-step-up' and any(q in ['machine','cable','barbell','dumbbell','bench','band'] for q in e['equipment']) else 'excluded'
    local = root / 'public' / video.lstrip('/') if video and video.startswith('/') else None
    row = {**{k:e.get(k) for k in ['id','canonicalId','name','equipment','primaryMuscles','secondaryMuscles','difficulty','tags','tracking']},'collection':place,'video':video,'poster':poster,'videoExists':bool(local and local.is_file()),'posterExists':bool(poster and (root/'public'/poster.lstrip('/')).is_file()),'provenance':media.get('mediaSource',e.get('mediaSource')),'license':media.get('license',e.get('mediaLicenseStatus'))}
    if local and local.is_file():
        row.update(bytes=local.stat().st_size,sha256=hashlib.sha256(local.read_bytes()).hexdigest())
        if shutil.which('ffprobe'):
            result = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',str(local)],capture_output=True,text=True,check=True)
            row['encoding']=json.loads(result.stdout)
    rows.append(row)
bird = [p.name for p in (root/'public/media/video').glob('*bird*')]
out={'records':len(rows),'eligibleHome':sum(r['collection']=='home' and r['videoExists'] for r in rows),'eligibleGym':sum(r['collection']=='gym' and r['videoExists'] for r in rows),'birdDogFiles':bird,'birdDogOppositeSide':'Mirrored existing owner video; separate right-side file absent','exercises':rows}
target=root/'evidence/functional-review/media-inventory.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in out.items() if k!='exercises'}))
