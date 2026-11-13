import {afterEach,expect,test,vi} from 'vitest';
import {cueSpeech} from '../src/server/tts';
import {workoutVoice,voiceLine} from '../src/locales/workout-voice';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
test('workout cache-only misses cannot contact the configured voice gateway',async()=>{
  vi.stubEnv('TTS_EN_BASE_URL','https://unused.example.test');vi.stubEnv('TTS_EN_API_KEY','disposable-test-only');vi.stubEnv('TTS_EN_VOICE','test');vi.stubEnv('TTS_EN_MODEL','test-cache-only');
  const network=vi.fn(()=>{throw new Error('Unexpected paid provider call');});vi.stubGlobal('fetch',network);
  await expect(cueSpeech('test',{kind:'encourage',lang:'en',cachedOnly:'1'})).rejects.toMatchObject({code:'VOICE_NOT_CACHED'});
  expect(network).not.toHaveBeenCalled();
});
test('voice templates and player controls have parallel English/Myanmar contracts',()=>{
  expect(Object.keys(workoutVoice.my).sort()).toEqual(Object.keys(workoutVoice.en).sort());
  expect(voiceLine('en','getReady',{name:'Bird Dog'})).toContain('Bird Dog');
  expect(voiceLine('my','encourage')).toMatch(/[\u1000-\u109f]/);
});
