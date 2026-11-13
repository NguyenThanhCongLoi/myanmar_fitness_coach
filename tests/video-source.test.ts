import {expect,test} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import original from '../prisma/exercise-media-original.json';
import variants from '../src/shared/video-variants.json';
import receipts from '../evidence/functional-review/mobile-video.json';
import {playbackSource} from '../src/shared/video-source';
test('19 light clips preserve approved exercise identity and original files; no substitution for missing media',()=>{
  expect(Object.keys(variants)).toHaveLength(19);
  for(const entry of Object.values(original)){
    const url=entry.videoUrl,mobile=playbackSource(url,true)!;
    expect(playbackSource(url,false)).toBe(url);expect(mobile).toBe('/media/video/mobile/'+url.split('/').at(-1));
    expect(existsSync('public'+mobile)).toBe(true);
    const receipt=receipts.find(r=>r.original===url)!;
    expect(createHash('sha256').update(readFileSync('public'+url)).digest('hex')).toBe(receipt.originalSha256);
    expect(createHash('sha256').update(readFileSync('public'+mobile)).digest('hex')).toBe(receipt.sha256);
  }
  expect(playbackSource(null,true)).toBeNull();expect(playbackSource('/media/video/gym-leg-press.mp4',true)).toBe('/media/video/gym-leg-press.mp4');
});
