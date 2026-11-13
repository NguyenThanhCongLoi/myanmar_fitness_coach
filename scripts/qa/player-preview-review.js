async page => {
  const origin=new URL(page.url()).origin;if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const post=async(path,data)=>{const r=await page.request.post(origin+path,{data,headers:{Origin:origin}});if(!r.ok())throw new Error(path+': '+r.status());return r.json();};
  const b=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());
  if(b.activeSession){const s=await page.request.get(origin+'/api/training/sessions/'+b.activeSession.id).then(r=>r.json());await post('/api/training/sessions/'+s.id+'/action',{kind:'abandon',actionId:'preview-abandon-'+Date.now(),revision:s.revision,confirm:true});}
  const s=await post('/api/training/free',{name:'Disposable bilateral timer check',location:'home',exercises:[
    {exerciseId:'curated-bird-dog',sets:2,reps:2,restSeconds:10,targetKg:0,timed:true},
    {exerciseId:'curated-plank',sets:1,reps:2,restSeconds:10,targetKg:0,timed:true},
  ]});
  await page.reload();await page.locator('button.hv-plan').click();await page.locator('.ps-day.current .big-start').click();await page.locator('.phase-ready').waitFor({timeout:30000});
  const started=Date.now();await page.locator('.phase-work').waitFor({timeout:20000});const preparationMs=Date.now()-started;
  if(preparationMs<8500||preparationMs>16000)throw new Error('Preparation is not ten real seconds: '+preparationMs);
  await page.locator('.phase-rest').waitFor({timeout:10000});
  const restStarted=Date.now();
  if(!await page.locator('.player-media video.opposite-side').count())throw new Error('Right-side preview not mirrored');
  if(!(await page.locator('.minimal-caption h2').innerText()).includes('Right side'))throw new Error('Missing side label');
  await page.waitForFunction(()=>{const v=document.querySelector('.player-media video');return v&&v.readyState>=2&&!v.paused;});
  await page.screenshot({path:'D:/workout_fitness/evidence/intake-release/rest-next-video.png'});
  await page.locator('.phase-work').waitFor({timeout:15000});const restMs=Date.now()-restStarted;
  if(restMs<8500||restMs>15000)throw new Error('Rest is not ten real seconds: '+restMs);
  await page.screenshot({path:'D:/workout_fitness/evidence/intake-release/player-work.png'});
  await page.waitForFunction(()=>!document.querySelector('.minimal-player'),{},{timeout:25000});
  const saved=await page.request.get(origin+'/api/training/sessions/'+s.id).then(r=>r.json());
  if(saved.status!=='completed'||saved.sets.length!==3||saved.sets.some(x=>x.seconds!==2))throw new Error('Incorrect actual timed work');
  return {result:'PASS',preparationMs,restMs,sets:saved.sets.map(x=>({exerciseId:x.exerciseId,setIndex:x.setIndex,seconds:x.seconds})),errors};
}
