"""Select reviewed non-media fields only; no image/GIF/video files are imported."""
import csv
import html
import json
from pathlib import Path
import re
import unicodedata

PRODUCT = Path(__file__).resolve().parents[1]
REFERENCES = PRODUCT.parent / 'references'
def normalize(value):
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', unicodedata.normalize('NFC', value).casefold())).strip()
def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', ' ', value)).strip()

records = []
core = {}
with (REFERENCES / 'workout-cool/data/sample-exercises.csv').open(encoding='utf-8') as stream:
    for row in csv.DictReader(stream):
        item = core.setdefault(row['id'], {'row': row, 'muscles': [], 'equipment': []})
        if row['attribute_name'] in ('PRIMARY_MUSCLE', 'SECONDARY_MUSCLE'):
            item['muscles'].append(row['attribute_value'].lower().replace('_', ' '))
        if row['attribute_name'] == 'EQUIPMENT': item['equipment'].append(row['attribute_value'].lower())
for source_id, item in core.items():
    row = item['row']
    records.append({'id': 'core-' + source_id, 'name': row['name_en'], 'normalizedName': normalize(row['name_en']),
        'instructions': plain(row['description_en']), 'muscles': item['muscles'], 'equipment': item['equipment'],
        'source': 'workout-cool', 'sourceId': source_id, 'sourceUrl': 'https://github.com/Snouzy/workout-cool',
        'dataLicense': 'MIT', 'attribution': 'Workout.cool contributors; MIT. Third-party media not imported.', 'mediaStatus': 'not_imported'})

selected = {'0276', '0662', '0294', '0293', '0289', '1373', '3470', '3013', '1460'}
dataset = json.loads((REFERENCES / 'exercises-dataset/data/exercises.json').read_text(encoding='utf-8'))
seen = {row['normalizedName'] for row in records}
for item in dataset:
    if item['id'] not in selected or normalize(item['name']) in seen: continue
    seen.add(normalize(item['name']))
    records.append({'id': 'dataset-' + item['id'], 'name': item['name'].capitalize(), 'normalizedName': normalize(item['name']),
        'instructions': item['instructions']['en'], 'muscles': list(dict.fromkeys([item.get('target', ''), *item.get('secondary_muscles', [])])),
        'equipment': [item['equipment']], 'source': 'exercises-dataset', 'sourceId': item['id'],
        'sourceUrl': 'https://github.com/hasaneyldrm/exercises-dataset', 'dataLicense': 'MIT',
        'attribution': 'Non-media data © 2026 Hasan Emir Yıldırım; MIT. Original media attribution: ' + item.get('attribution', '') + ' (media not imported).',
        'mediaStatus': 'not_imported'})
assert len({row['id'] for row in records}) == len(records)
assert all(row['instructions'] and not any(key in row for key in ['image', 'gif_url', 'fullVideoUrl', 'media_id']) for row in records)
(PRODUCT / 'prisma/exercises.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'exercises': len(records), 'core': len(core), 'media_imported': 0}))
