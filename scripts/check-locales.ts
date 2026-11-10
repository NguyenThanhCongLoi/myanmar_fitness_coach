import assert from 'node:assert/strict';
import en from '../src/locales/en';
import my from '../src/locales/my-MM';
import gameEn from '../src/locales/game-en';
import gameMy from '../src/locales/game-my';
function check(a: unknown,b: unknown,path='root') {
  if(typeof a==='string'){assert.equal(typeof b,'string',path);assert.ok((b as string).trim(),path);return;}
  assert.deepEqual(Object.keys(b as object).sort(),Object.keys(a as object).sort(),path);
  for(const key of Object.keys(a as object))check((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],`${path}.${key}`);
}
check(en,my);check(gameEn,gameMy);console.log('PASS: Myanmar and English locale contracts');
