"""Generate small H.264/fast-start variants of owner-supplied Home clips (run on remote CPU)."""
import hashlib
import json
from pathlib import Path
import subprocess

root=Path(__file__).resolve().parents[1]
original=json.loads((root/'prisma/exercise-media-original.json').read_text(encoding='utf-8'))
variants={};receipts=[]
for exercise,entry in original.items():
    url=entry['videoUrl'];source=root/'public'/url.lstrip('/')
    target=root/'public/media/video/mobile'/source.name;target.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-an','-vf',r'scale=min(360\,iw):-2','-r','24','-c:v','libx264','-preset','fast','-b:v','220k','-maxrate','260k','-bufsize','260k','-g','24','-pix_fmt','yuv420p','-profile:v','baseline','-movflags','+faststart',str(target)],check=True)
    mobile='/media/video/mobile/'+source.name;variants[url]=mobile
    receipts.append({'exerciseId':exercise,'original':url,'mobile':mobile,'originalSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'provenance':entry.get('license'),'encoding':'H.264 baseline, max360px width,24fps,220kbps target,260kbps peak,1s keyframes,faststart,no audio'})
(root/'src/shared/video-variants.json').write_text(json.dumps(variants,indent=2)+'\n',encoding='utf-8')
out=root/'evidence/functional-review/mobile-video.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'variants':len(receipts),'originalBytes':sum((root/'public'/r['original'].lstrip('/')).stat().st_size for r in receipts),'mobileBytes':sum(r['bytes'] for r in receipts)}))
