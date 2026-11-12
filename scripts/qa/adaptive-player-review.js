async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=new URL(page.url()).origin;if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Preview only');
 const library=await page.request.get(origin+'/api/training/exercises').then(r=>r.json());
 const e=library.find(e=>e.videoUrl&&e.mediaLicenseStatus==='verified'&&e.equipment.every(q=>q==='body weight')&&!(e.tags||[]).some(t=>['warmup','cooldown'].includes(t)));
 if(!e)throw new Error('No licensed bodyweight video');
 const response=await page.request.post(origin+'/api/training/free',{data:{name:'Video viewport validation',exercises:[{exerciseId:e.id,sets:1,reps:20,restSeconds:10,targetKg:0,timed:true}]}});if(!response.ok())throw new Error(await response.text());
 const checks=[];
 for(const locale of ['en','my-MM'])for(const theme of ['light','dark']){
  await page.evaluate(({locale,theme})=>{localStorage.setItem('mingalar-locale',locale);localStorage.setItem('mingalar-theme',theme)}, {locale,theme});await page.reload();await page.locator('.adaptive-card').waitFor();
  await page.locator('.today-hero .big-start').click();await page.locator('.player-ready').waitFor();await page.locator('.player-bar .icon-button').first().click();
  await page.waitForFunction(()=>document.querySelector('.player video')?.readyState>=2,{timeout:30000});
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);const v=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,video:{width:document.querySelector('video').videoWidth,height:document.querySelector('video').videoHeight,ready:document.querySelector('video').readyState}}));if(v.overflow>0)throw new Error(JSON.stringify({locale,theme,width,...v}));checks.push({locale,theme,width,...v});}
  await page.setViewportSize({width:320,height:850});await page.locator('.modal-backdrop,.modal-overlay').count();
  // Closing via the last primary action resumes; do not choose an exit reason.
  await page.locator('dialog .button.primary').click();
  await page.screenshot({path:`evidence/adaptive-video-${locale}-${theme}-320.png`,fullPage:true});
 }
 await page.locator('.player-bar .icon-button').first().click();await page.locator('.quit-reasons button').nth(1).click();await page.locator('.adaptive-card').waitFor();
 return{result:errors.length?'FAIL':'PASS',exerciseId:e.id,pageErrors:errors,checks};
}
