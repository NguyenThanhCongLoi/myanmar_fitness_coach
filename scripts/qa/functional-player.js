async page=>{
  const origin=new URL(page.url()).origin;
  if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[],cues=[];page.on('pageerror',e=>errors.push(e.message));
  const post=async(path,data)=>{const r=await page.request.post(origin+'/api/'+path,{data,headers:{Origin:origin}});if(!r.ok())throw new Error(path+': '+r.status()+' '+await r.text());return r.json();};
  const get=async path=>page.request.get(origin+'/api/'+path).then(r=>r.json());
  // A short synthetic WAV exercises browser audio without contacting a paid voice provider.
  const wav=Buffer.alloc(44+3200);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(3200,40);
  for(let i=0;i<1600;i++)wav.writeInt16LE(Math.round(Math.sin(i*.4)*1000),44+i*2);
  await page.route('**/api/training/tts/status',r=>r.fulfill({json:{en:true,my:true}}));
  await page.route('**/api/training/tts/cue?**',r=>{cues.push(new URL(r.request().url()).search);return r.fulfill({contentType:'audio/wav',body:wav});});
  await page.addInitScript(()=>{
    window.__audio=[];const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(this.tagName==='AUDIO'&&!window.__audio.includes(this))window.__audio.push(this);return play.apply(this,arguments);};
  });
  await page.evaluate(()=>{localStorage.setItem('mingalar-music','pump');localStorage.setItem('mingalar-music-volume','0.35');localStorage.setItem('mingalar-voice','on');});
  const boot=await get('fitness/bootstrap');if(boot.activeSession){const old=await get('training/sessions/'+boot.activeSession.id);await post('training/sessions/'+old.id+'/action',{actionId:'qa-cleanup-'+Date.now(),revision:old.revision,kind:'abandon',confirm:true,reason:'later'});}
  const s=await post('training/free',{name:'Bird pair and next preview',location:'home',exercises:[{exerciseId:'curated-bird-dog',sets:2,reps:3,restSeconds:10,targetKg:0,timed:true},{exerciseId:'curated-plank',sets:1,reps:3,restSeconds:10,targetKg:0,timed:true}]});
  await page.reload();await page.locator('button.hv-plan').click();await page.locator('.start-bar-go').click();
  await page.locator('.phase-work').waitFor({timeout:20000});
  await page.locator('.phase-rest').waitFor({timeout:15000});
  if(!await page.locator('.player-media video.opposite-side').count())throw new Error('Opposite Bird Dog not previewed during rest');
  const count=()=>page.locator('.minimal-count').evaluate(e=>Number(e.firstChild.textContent));
  await page.getByRole('button',{name:'Pause',exact:true}).click();const before=await count();await page.waitForTimeout(1300);if(await count()!==before)throw new Error('Paused rest moved');
  await page.waitForTimeout(5200);const durable=await get('training/sessions/'+s.id+'/playback');
  if(durable.phase!=='rest'||durable.remaining!==before)throw new Error('Rest checkpoint not durable');
  await page.reload();await page.locator('button.hv-plan').click();await page.locator('.start-bar-go').click();await page.locator('.phase-rest').waitFor();
  const restored=await count();await page.waitForTimeout(1200);if(await count()!==restored||restored!==before)throw new Error('Reload consumed/restarted rest');
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.locator('.phase-work').waitFor({timeout:20000});if(!await page.locator('.opposite-side').count())throw new Error('Right side missing');
  await page.locator('.phase-rest').waitFor({timeout:12000});
  if(!(await page.locator('.minimal-caption h2').innerText()).toLowerCase().includes('plank'))throw new Error('Next video/name mismatch');
  const transitionRest=await count();if(transitionRest<18)throw new Error('Exercise transition not included');
  const audio=await page.evaluate(()=>window.__audio.map(a=>({src:a.src.startsWith('blob:')?'voice':a.src.split('/').at(-1),paused:a.paused,volume:a.volume,decoded:a.readyState>=2,currentTime:a.currentTime,loop:a.loop})));
  await page.screenshot({path:'D:/workout_fitness/myanmar-fitness-coach/evidence/functional-review/rest-next.png'});
  await page.waitForFunction(()=>!document.querySelector('.minimal-player'),{},{timeout:40000});
  const saved=await get('training/sessions/'+s.id);
  if(saved.status!=='completed'||saved.sets.length!==3||saved.completionPct!==100)throw new Error('Completion lost '+JSON.stringify(saved));
  const again=await post('fitness/sessions/'+s.id+'/finish',{note:''});if(again.reward.awarded)throw new Error('Duplicate reward');
  if(cues.some(q=>!q.includes('cachedOnly=1')))throw new Error('Unexpected paid synthesis path');
  return {result:'PASS',session:s.id,autoLeftRightNext:true,restCheckpoint:{before,restored},transitionRest,sets:saved.sets.map(x=>({exerciseId:x.exerciseId,setIndex:x.setIndex,seconds:x.seconds})),completionPct:saved.completionPct,activeSeconds:(new Date(saved.endedAt)-new Date(saved.startedAt)-saved.totalPausedMs)/1000,audio,cueRequests:cues.length,voiceMock:'synthetic WAV, no paid provider',errors};
}
