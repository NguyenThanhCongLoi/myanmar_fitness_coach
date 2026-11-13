async page=>{
  const origin=new URL(page.url()).origin;if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const post=async(path,data)=>{const r=await page.request.post(origin+'/api/'+path,{data,headers:{Origin:origin}});if(!r.ok())throw new Error(path+': '+r.status());return r.json();};
  const boot=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());if(boot.activeSession){const old=await page.request.get(origin+'/api/training/sessions/'+boot.activeSession.id).then(r=>r.json());await post('training/sessions/'+old.id+'/action',{actionId:'qa-slow-retry-'+Date.now(),revision:old.revision,kind:'abandon',confirm:true,reason:'later'});}
  const session=await post('training/free',{name:'Slow media preview',location:'home',exercises:[{exerciseId:'vid-shadow-boxing',sets:1,reps:3,restSeconds:10,targetKg:0,timed:true},{exerciseId:'vid-sumo-squat',sets:1,reps:3,restSeconds:10,targetKg:0,timed:true}]});
  await page.evaluate(()=>{localStorage.setItem('mingalar-lowdata','on');localStorage.setItem('mingalar-music','none');localStorage.setItem('mingalar-voice','off');});
  await page.reload();await page.locator('button.hv-plan').click();await page.locator('.start-bar-go').waitFor();
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const videos=new Set();page.on('request',r=>{if(r.url().includes('/media/video/'))videos.add(new URL(r.url()).pathname);});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:180,downloadThroughput:50000,uploadThroughput:50000,connectionType:'cellular3g'});
  const start=Date.now();
  try{
    await page.evaluate(()=>{window.__mediaEvents=[];for(const type of ['loadeddata','waiting','playing','error'])document.addEventListener(type,e=>{if(e.target instanceof HTMLVideoElement&&e.target.closest('.player-media'))window.__mediaEvents.push({type,at:performance.now(),src:e.target.currentSrc,readyState:e.target.readyState});},true);window.__mediaStart=performance.now();});
    await page.locator('.start-bar-go').click();await page.locator('.minimal-player').waitFor();
    await page.waitForFunction(()=>document.querySelector('.player-media video')?.readyState>=2,{},{timeout:60000});
    const firstPlayableMs=Date.now()-start;
    if(await page.locator('video[data-next-video]').count()!==1)throw new Error('Next preload not bounded to one');
    await page.locator('.phase-rest').waitFor({timeout:60000});
    const nextPreview=await page.locator('.player-media video').getAttribute('src');
    await page.setViewportSize({width:320,height:800});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('320px player overflow');
    await page.screenshot({path:'D:/workout_fitness/myanmar-fitness-coach/evidence/functional-review/slow-media-320.png'});
    await page.waitForFunction(()=>!document.querySelector('.minimal-player'),{},{timeout:60000});
    const saved=await page.request.get(origin+'/api/training/sessions/'+session.id).then(r=>r.json());
    if(saved.status!=='completed'||saved.sets.length!==2)throw new Error('Slow-network progression failed');
    const events=await page.evaluate(()=>window.__mediaEvents);
    if(events.some(e=>e.type==='error'))throw new Error('Video error on slow network');
    if([...videos].some(v=>!v.includes('/mobile/')))throw new Error('Low-data mode did not choose small variants');
    if(videos.size>2)throw new Error('Preloaded unrelated videos');
    return {result:'PASS',network:{latencyMs:180,downloadBytesPerSecond:50000,cacheDisabled:true},firstPlayableMs,totalElapsedMs:Date.now()-start,nextPreview,requestedVideos:[...videos],events,overflow320:overflow,completionPct:saved.completionPct};
  }finally{await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});await cdp.detach();await page.setViewportSize({width:390,height:900});}
}
