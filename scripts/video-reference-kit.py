"""Build an offline Vietnamese creator catalog from existing, attributed assets."""
import csv, hashlib, html, json, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/video-production-kit'
OUT.mkdir(parents=True, exist_ok=True)
load = lambda name: json.loads((ROOT / 'prisma' / name).read_text(encoding='utf-8'))
catalog = load('exercise-catalog.json')
media, wger, original = [load(n) for n in ('exercise-media.json','exercise-media-wger.json','exercise-media-original.json')]
guidance, steps = load('exercise-guidance.json'), load('exercise-steps.json')
names = '''Chùng chân lùi luân phiên với đòn|Kéo dây về mặt (Face pull)|Bật nhảy qua ghế|Nhón gót đứng bằng trọng lượng cơ thể|Dead bug – duỗi tay/chân đối bên|Đẩy ngực với tạ đơn trên ghế|Kéo tạ đơn khi gập hông|Cuốn tay trước với tạ đơn|Chùng chân bước tới|Nâng hông trên sàn (Glute bridge)|Chống đẩy|Chùng chân bước đi|Squat không tạ|Squat với đòn sau vai|Plank cẳng tay|Plank nghiêng|Bird dog – tay/chân đối bên|Chống đẩy vào tường|Chống đẩy bằng gối|Đẩy vai với tạ đơn|Nâng tạ đơn sang ngang|Kéo dây kháng lực|Gập hông không tạ|Bước lên bục thấp|Đi bộ tại chỗ|Giãn bắp chân đứng|Đứng tập thở|Nâng gối khi ngồi|Ngồi dựa tường (Wall sit)|Nhón gót giữ thăng bằng|Kéo xô máy|Kéo cáp ngồi|Đẩy cáp tay sau|Ép ngực máy (Pec deck)|Đẩy ngực máy|Đạp đùi máy (Leg press)|Duỗi đùi máy|Cuốn đùi sau máy tư thế ngồi|Đẩy ngực với đòn|Deadlift với đòn|Romanian deadlift|Kéo đòn khi gập hông|Ép ngực với cáp|Gập bụng (Crunch)|Nâng tay chân nằm sấp (Superman)|Cuốn tạ đơn kiểu búa|Chống tay sau trên ghế|Khép đùi máy|Đẩy vai máy|Kéo xà bằng máy trợ lực|Cuốn đùi sau máy tư thế nằm|Squat máy Smith|Squat máy Hack|Nhón gót máy tư thế ngồi|Cuốn tay trước với cáp|Đẩy ngực tạ đơn trên ghế dốc|Đá tạ tay sau (Kickback)|Duỗi tay sau với tạ qua đầu|Hip thrust – nâng hông tựa ghế|Kéo xà|Nâng tạ vai sau khi gập hông|Cuốn tay trước với đòn'''.split('|')
expected_ids = '''core-157 core-163 core-164 dataset-1373 dataset-0276 dataset-0289 dataset-0293 dataset-0294 dataset-3470 dataset-3013 dataset-0662 dataset-1460 curated-squat curated-barbell-squat curated-plank curated-side-plank curated-bird-dog curated-wall-push curated-knee-push curated-shoulder-press curated-lateral-raise curated-band-row curated-hip-hinge curated-step-up curated-march curated-calf-stretch curated-breathing curated-seated-march curated-wall-sit curated-heel-walk gym-lat-pulldown gym-seated-cable-row gym-triceps-pushdown gym-pec-deck gym-machine-chest-press gym-leg-press gym-leg-extension gym-lying-leg-curl gym-barbell-bench-press gym-barbell-deadlift gym-romanian-deadlift gym-barbell-row gym-cable-crossover home-crunch home-superman home-hammer-curl home-bench-dips gym-hip-adduction gym-machine-shoulder-press gym-assisted-pullup gym-lying-leg-curl-machine gym-smith-squat gym-hack-squat gym-seated-calf-raise gym-cable-biceps-curl gym-incline-dumbbell-press gym-triceps-kickback gym-overhead-triceps-extension gym-hip-thrust gym-pull-up gym-rear-delt-raise gym-barbell-curl'''.split()
# Never silently assign a Vietnamese label to the wrong ID after catalog reordering.
assert [e['id'] for e in catalog] == expected_ids
assert len(names) == len(catalog) == 62
equipment = {'body weight':'Không cần tạ','dumbbell':'Tạ đơn','barbell':'Đòn và bánh tạ','bench':'Ghế/bục chắc chắn','band':'Dây kháng lực','machine':'Máy tập','cable':'Máy cáp'}
# Primary reference pages are linked, not downloaded or relicensed.
refs = {
 'dataset-0276': 'https://www.acefitness.org/resources/everyone/exercise-library/147/supine-dead-bug/',
 'curated-plank': 'https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/',
 'curated-bird-dog': 'https://www.nasm.org/resource-center/exercise-library/bird-dog',
 'dataset-1460': 'https://www.acefitness.org/resources/everyone/blog/6971/5-lunge-variations-for-leaner-legs/',
 'curated-band-row': 'https://www.nasm.org/workout-exercise-guidance',
 'curated-knee-push': 'https://www.acefitness.org/resources/everyone/exercise-library/',
 'dataset-1373': 'https://www.heart.org/en/healthy-living/exercise-and-physical-activity',
}
notes = {
 'curated-heel-walk': 'ID cũ ghi heel-walk nhưng nhãn hiện tại là heel raise. Chốt rõ nhón gót hay đi bằng gót với HLV trước khi quay.',
 'gym-lying-leg-curl': 'ID cũ ghi lying nhưng tên bài hiện tại là Seated leg curl. Quay tư thế NGỒI; bài tư thế NẰM có ID gym-lying-leg-curl-machine riêng.',
 'core-164': 'Động tác bật qua ghế: cần HLV duyệt chiều cao bục, mặt sàn và cách tiếp đất trước khi quay.',
}
rows, credits, cards, hashes = [], [], [], []
esc = lambda s: html.escape(str(s), quote=True)
for e, vi in zip(catalog, names):
    ident = e['id']
    m = {**media.get(ident, {}), **wger.get(ident, {}), **original.get(ident, {})}
    g = guidance.get(ident, {})
    place = 'gym' if any(q in e['equipment'] for q in ('barbell','machine','cable')) else 'home'
    imgs = []
    candidates = [(m.get('thumbnailUrl'), m.get('mediaSource','')+' '+m.get('page',''), m.get('license','Xem credit nguồn'))]
    candidates += [(v['image'],v['credit'],'Xem giấy phép trong credit ảnh') for _,v in sorted(m.get('steps',{}).items())]
    seen = set()
    for url, credit, license_name in candidates:
        if not url or url in seen: continue
        seen.add(url)
        source = (ROOT / 'public' / url.lstrip('/')).resolve()
        if not source.is_relative_to((ROOT/'public').resolve()) or not source.is_file():
            raise ValueError(f'Missing/invalid registered image: {ident} {url}')
        target = OUT/'images'/ident/source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        rel = target.relative_to(OUT).as_posix()
        imgs.append(rel)
        credits.append({'exercise_id':ident,'file':rel,'license':license_name,'credit':credit,'registry':url})
        hashes.append({'file':rel,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    eq = ', '.join(equipment.get(q,q) for q in e['equipment'])
    row = {'id':ident,'ten_viet':vi,'english_name':e['name'],'group':place,'equipment':eq,'primary_muscles':'; '.join(e['primaryMuscles']),'secondary_muscles':'; '.join(e['secondaryMuscles']),'level':e['difficulty'],'per_side':g.get('perSide',False),'images':'; '.join(imgs),'image_status':'Có ảnh tham chiếu' if imgs else 'THIẾU ẢNH','video_status':'Có demo cần HLV duyệt' if m.get('videoUrl') else 'CẦN TẠO VIDEO','existing_demo':('https://avibigateway--myanmar-fitness-coach.modal.run'+m['videoUrl']) if m.get('videoUrl') else '', 'reference_page':refs.get(ident,m.get('page','')),'loop_output':f'{ident}-loop.mp4','follow_output':f'{ident}-follow.mp4','poster_output':f'{ident}-poster.webp','steps':' | '.join(steps.get(ident,[e['instructions']])),'setup':' | '.join(g.get(place,[])),'mistakes':' | '.join(e.get('commonMistakes',[])),'review_note':notes.get(ident,'')}
    rows.append(row)
    images = ''.join(f'<a href="{esc(p)}" target="_blank"><img src="{esc(p)}" alt="{esc(vi)} – ảnh {i+1}" loading="lazy"></a>' for i,p in enumerate(imgs)) if imgs else '<div class="empty">Chưa có ảnh cục bộ đúng bài<br><small>Cần HLV bổ sung ảnh chuẩn trước khi dựng</small></div>'
    links = (f'<a href="{esc(row["reference_page"])}" target="_blank" rel="noreferrer">Mở nguồn tham khảo ↗</a>' if row['reference_page'] else '') + (f'<a href="{esc(row["existing_demo"])}" target="_blank" rel="noreferrer">Xem demo hiện có ↗</a>' if row['existing_demo'] else '')
    review = f'<p class="review">{esc(row["review_note"])}</p>' if row['review_note'] else ''
    cards.append(f'''<article data-place="{place}" data-name="{esc(vi+' '+e['name']+' '+ident)}" data-missing="{str(not imgs).lower()}"><header><small>{'TẠI NHÀ' if place=='home' else 'THIẾT BỊ GYM'} · {esc(e['difficulty'])}</small><h2>{esc(vi)}</h2><p>{esc(e['name'])}</p><code>{ident}</code></header><div class="images">{images}</div><p><b>Dụng cụ:</b> {esc(eq)}</p><p><b>Cơ chính:</b> {esc(row['primary_muscles'])}</p><p><b>Hai bên:</b> {'Có – quay cả trái/phải' if row['per_side'] else 'Không yêu cầu clip tách bên'}</p><span class="badge">{esc(row['video_status'])}</span>{review}<details><summary>Trình tự, setup và lỗi cần tránh</summary><ol>{''.join('<li>'+esc(s)+'</li>' for s in steps.get(ident,[e['instructions']]))}</ol><p>{esc(row['setup'])}</p><p>{esc(row['mistakes'])}</p></details><p class="outputs">Xuất: <code>{esc(row['loop_output'])}</code><br><code>{esc(row['follow_output'])}</code><br><code>{esc(row['poster_output'])}</code></p><nav>{links}</nav></article>''')

def csv_file(filename, data, fields=None):
    with (OUT/filename).open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=fields or list(data[0]));writer.writeheader();writer.writerows(data)

csv_file('TAT_CA_62_BAI.csv',rows)
csv_file('TAI_NHA.csv',[r for r in rows if r['group']=='home'])
csv_file('PHONG_GYM.csv',[r for r in rows if r['group']=='gym'])
csv_file('CAN_BO_SUNG_ANH.csv',[r for r in rows if r['image_status']=='THIẾU ẢNH'])
csv_file('NGUON_VA_GIAY_PHEP.csv',credits)
(OUT/'MANIFEST.json').write_text(json.dumps({'exercises':rows,'files':hashes},ensure_ascii=False,indent=2),encoding='utf-8')
summary = {'total':len(rows),'home':sum(r['group']=='home' for r in rows),'gym':sum(r['group']=='gym' for r in rows),'with_images':sum(bool(r['images']) for r in rows),'missing_images':sum(not r['images'] for r in rows),'image_files':len(credits),'missing_videos':sum(not r['existing_demo'] for r in rows)}
readme = f'''# Gói tham chiếu làm video – 13/11/2026

Mở `index.html` bằng Edge/Chrome để xem ảnh, lọc tại nhà/gym và tìm theo tên/ID. Ảnh nằm sẵn trong `images/`, không cần mạng. Link demo/nguồn ngoài cần mạng.

- Tổng {summary['total']} bài, chia {summary['home']} bài tại nhà và {summary['gym']} bài cần thiết bị gym. Các bài tại nhà cũng dùng được ở gym; không tạo trùng ID. Nhóm tại nhà có thể cần tạ đơn, dây, ghế/bục chắc chắn – xem từng dòng.
- {summary['with_images']} bài có ảnh cục bộ ({summary['image_files']} file gốc); {summary['missing_images']} bài thiếu ảnh đúng động tác, được liệt kê trong `CAN_BO_SUNG_ANH.csv`. Không dùng ảnh của bài khác để lấp chỗ trống. Link ACE/NASM/AHA chỉ để tham khảo; không cấp quyền sao chép ảnh của họ.
- {summary['missing_videos']} bài chưa có demo; demo còn lại vẫn cần HLV kiểm tra tư thế trước khi dùng làm chuẩn quay.
- CSV có BOM UTF-8 để mở bằng Excel: `TAI_NHA.csv`, `PHONG_GYM.csv`, `TAT_CA_62_BAI.csv`.

## Mỗi bài cần sản xuất

1. `ID-loop.mp4`: 8–15 giây, 2–3 lần lặp chậm, toàn thân và điểm tiếp xúc sàn/dụng cụ luôn nằm trong khung. Tư thế giữ tĩnh quay đúng tư thế; không ép thêm chuyển động.
2. `ID-follow.mp4`: 30–60 giây để tập cùng. Bài một bên quay đủ trái/phải và có cue chuyển bên. Không tự nhân đôi số lần kê đơn.
3. `ID-poster.webp`: tư thế bắt đầu; thêm ảnh tư thế giữa/cuối và setup nếu là máy gym.
4. Khung dọc 9:16, 1080×1920, 24–30fps; MP4 H.264/yuv420p/faststart. Nếu có thể thêm bản ngang 16:9. Nền sáng, trang phục tương phản, máy cố định; không cắt chân/tay, không rung/zoom, không chữ hay đồng hồ đóng cứng vào hình.
5. Gym quay rõ chỉnh ghế, chốt tạ, tay nắm, vào/ra máy; động tác có tải được HLV duyệt. Âm nhạc/voice để file riêng; không đưa nhạc thương mại chưa có quyền vào video.

## Trước khi quay

Tên Việt là nhãn bàn giao; English name và ID là khóa đối chiếu. Hai ID cũ có lưu ý đặc biệt: `gym-lying-leg-curl` hiện là tư thế **ngồi**, còn `gym-lying-leg-curl-machine` là **nằm**; `curated-heel-walk` cần chốt đúng động tác nhón gót theo nhãn, không suy ra từ ID. Không thay thế biến thể âm thầm. Các hướng dẫn hiện có là bản nháp sản phẩm, không thay cho HLV duyệt kỹ thuật.

Nguồn/quyền từng file giữ nguyên tại `NGUON_VA_GIAY_PHEP.csv`; hash trong `MANIFEST.json` xác nhận ảnh được sao chép nguyên byte. Không xóa credit khi tái sử dụng file gốc có yêu cầu ghi công/share-alike. Video chủ sở hữu tự tạo cần quyền người biểu diễn, được HLV duyệt trước khi nhập manifest app. Chỉ dùng ảnh như tài liệu tham khảo, không mặc định ảnh là tư thế kỹ thuật đã được chứng nhận.
'''
(OUT/'README.vi.md').write_text(readme,encoding='utf-8')
page = '''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bộ tham chiếu video – Mingalar Fit</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#242a34;font:16px/1.65 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:24px}h1{font-size:32px;line-height:1.2}h2{font-size:23px;line-height:1.3;margin:8px 0}a{color:#a84605}small{color:#586477}header p{margin:5px 0;color:#586477}.intro{max-width:900px}.toolbar{position:sticky;top:0;background:#fff;padding:12px 0;display:flex;flex-wrap:wrap;gap:10px;z-index:2;border-bottom:1px solid #ddd}button,input,select{font:inherit;padding:10px 14px;border:1px solid #d9dee5;border-radius:12px;min-height:46px;max-width:100%}input{flex:1;min-width:160px}button{cursor:pointer}button[aria-pressed=true]{background:#fff0e4;border-color:#fc7a1e;color:#973e00}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;padding-top:20px}article{border:1px solid #e0e4ea;border-radius:20px;padding:20px;min-width:0}article[hidden]{display:none}code{font-size:13px;overflow-wrap:anywhere}.images{display:flex;gap:8px;overflow-x:auto;min-height:200px;margin:16px 0}.images a{flex:0 0 80%;background:#f7f8fa;border-radius:12px}.images img{width:100%;height:220px;object-fit:contain}.empty{display:grid;place-content:center;min-height:220px;width:100%;background:#f7f8fa;border:1px dashed #ccd4df;border-radius:12px;text-align:center;padding:16px}.badge{background:#fff2e8;padding:6px 10px;border-radius:8px;font-size:14px}.outputs{color:#586477}.review{padding:12px;background:#fff4e4;border-left:3px solid #e18316}nav{display:flex;gap:14px;flex-wrap:wrap}details{margin-top:18px}summary{cursor:pointer;font-weight:600}footer{margin-top:30px;color:#586477}@media print{.toolbar{position:static}.grid{grid-template-columns:1fr 1fr}article{break-inside:avoid}.images{overflow:visible}nav{display:none}}</style><main><h1>Tham chiếu làm video tập luyện</h1><p class="intro">62 bài · 35 tại nhà · 27 thiết bị gym. Các bài tại nhà cũng dùng được ở gym. Có ảnh cục bộ cho 44 bài; 18 bài thiếu ảnh được đánh dấu rõ. Tư liệu hiện có cần HLV duyệt, không phải bộ hình chuẩn đã chứng nhận.</p><p><a href="TAI_NHA.csv">CSV tại nhà</a> · <a href="PHONG_GYM.csv">CSV phòng gym</a> · <a href="CAN_BO_SUNG_ANH.csv">Danh sách thiếu ảnh</a> · <a href="README.vi.md">Hướng dẫn quay</a> · <a href="NGUON_VA_GIAY_PHEP.csv">Nguồn/quyền ảnh</a></p><div class="toolbar"><button data-filter="all" aria-pressed="true">Tất cả 62</button><button data-filter="home" aria-pressed="false">Tại nhà 35</button><button data-filter="gym" aria-pressed="false">Gym 27</button><button data-filter="missing" aria-pressed="false">Thiếu ảnh 18</button><input aria-label="Tìm bài tập" placeholder="Tên bài hoặc ID…"><span id="count" aria-live="polite">62 bài</span></div><div class="grid">CARDS</div><footer>Ảnh gốc và credit được giữ riêng trong gói. Bấm ảnh để mở nguyên bản. Xem README trước khi quay.</footer></main><script>let filter='all';function update(){const q=document.querySelector('input').value.toLocaleLowerCase('vi');let n=0;document.querySelectorAll('article').forEach(e=>{e.hidden=!((filter==='all'||e.dataset.place===filter||(filter==='missing'&&e.dataset.missing==='true'))&&e.dataset.name.toLocaleLowerCase('vi').includes(q));if(!e.hidden)n++});document.querySelector('#count').textContent=n+' bài'}document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update()});document.querySelector('input').oninput=update;</script></html>'''.replace('CARDS',''.join(cards))
page = page.replace('</title>', '</title><link rel="icon" href="data:,">', 1)
(OUT/'index.html').write_text(page,encoding='utf-8')
with zipfile.ZipFile(ROOT/'docs/VIDEO_PRODUCTION_KIT.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
    for f in sorted(OUT.rglob('*')):
        if f.is_file(): archive.write(f,arcname='video-production-kit/'+f.relative_to(OUT).as_posix())
print(json.dumps(summary))
