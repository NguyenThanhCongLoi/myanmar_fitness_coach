"""Regenerate the complete creator shot list from stable exercise IDs. No downloads."""
import csv, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'prisma/exercise-catalog.json').read_text(encoding='utf-8'))
guidance=json.loads((root/'prisma/exercise-guidance.json').read_text(encoding='utf-8'))
media=json.loads((root/'prisma/exercise-media.json').read_text(encoding='utf-8'))
wger=json.loads((root/'prisma/exercise-media-wger.json').read_text(encoding='utf-8'))
rows=[]
for e in catalog:
 g=guidance.get(e['id'],{}); existing=wger.get(e['id'],{}).get('videoUrl') or media.get(e['id'],{}).get('videoUrl')
 home=not any(q in e['equipment'] for q in ['barbell','machine','cable'])
 rows.append({'id':e['id'],'name':e['name'],'priority':'P1 missing' if not existing else 'P2 replace demo', 'place':'home / gym' if home else 'gym', 'equipment':'; '.join(e['equipment']), 'primary':'; '.join(e['primaryMuscles']), 'secondary':'; '.join(e['secondaryMuscles']), 'tracking':e['tracking'],'per_side':g.get('perSide',False),'loop_file':f"{e['id']}-loop.mp4",'follow_file':f"{e['id']}-follow.mp4",'poster_file':f"{e['id']}-poster.webp",'loop_seconds':'8-15','follow_seconds':'30-60','views':'front 3/4 + side technique close-up','setup_cues':' | '.join(g.get('home' if home else 'gym',[])), 'mistakes':' | '.join(e.get('commonMistakes',[])),'existing_demo':existing or ''})
out=root/'docs/VIDEO_SHOT_LIST.csv'
with out.open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
print(json.dumps({'exercises':len(rows),'missing':sum(not r['existing_demo'] for r in rows),'path':str(out)}))
