async page => {
  const origin=new URL(page.url()).origin;
  if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  const signup=await page.request.post(origin+'/api/auth/sign-up/email',{data:{name:'Intake Save Preview',email:`save-${Date.now()}@example.test`,password:'Disposable-intake-save-2026'},headers:{Origin:origin}});
  if(!signup.ok())throw new Error('Preview signup failed: '+signup.status());
  await page.evaluate(()=>{localStorage.setItem('mingalar-locale','en');localStorage.setItem('mingalar-theme','light');});
  await page.setViewportSize({width:390,height:900});await page.reload();
  const at=async step=>{await page.locator(`.intake-v2[data-step="${step}"]`).waitFor();};
  const next=()=>page.locator('.quiz-next').click();
  const toggle=()=>page.getByRole('button',{name:'Language',exact:true}).click();
  await at('age');await next();await at('height');
  await page.getByRole('slider').focus();for(let i=0;i<5;i++)await page.getByRole('slider').press('ArrowRight');
  await toggle();if(await page.getByRole('slider').getAttribute('aria-valuenow')!=='170')throw new Error('Language reset selected height');
  if(await page.locator('html').getAttribute('lang')!=='my-MM')throw new Error('Wrong document language');
  await toggle();await next();await at('weight');await page.getByRole('slider').focus();for(let i=0;i<10;i++)await page.getByRole('slider').press('ArrowRight');
  await next();await at('sex');await page.locator('.quiz-grid button').nth(2).click();
  await next();await at('goal');await page.locator('.quiz-grid button').nth(3).click();
  await next();await at('level');await page.locator('.quiz-grid button').nth(0).click();
  await next();await at('activity');await page.locator('.quiz-grid button').nth(0).click();
  await next();await at('place');
  for(const index of [1,0]){await page.locator('.quiz-grid button').nth(index).click();if(await page.locator('.quiz-hint').count())throw new Error('Technical collection caption still visible');}
  await page.waitForTimeout(350);await page.screenshot({path:'D:/workout_fitness/evidence/intake-save/place.png'});
  await next();await at('days');await page.locator('.quiz-grid button').nth(1).click();
  await next();await at('minutes');await page.locator('.quiz-grid button').nth(1).click();
  await next();await at('health');await page.locator('.intake-checks input').nth(3).check();
  await next();await at('focus'); // There is no protected-area question or hidden requirement.
  await next();await at('waistNow');await next();await at('waistGoal');await next();await at('glutesNow');await next();await at('glutesGoal');await next();await at('review');
  const failing=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'REQUEST_FAILED'})});
  await page.route('**/api/training/intake',failing);await next();
  const alert=page.locator('.intake-v2 [role=alert]');await alert.waitFor();const english=await alert.innerText();
  if(!english.includes('Could not save'))throw new Error('Missing English failure');
  if(await page.locator('.toast').count())throw new Error('Duplicate error toast');
  await toggle();const myanmar=await alert.innerText();if(myanmar===english||!/[\u1000-\u109f]/.test(myanmar))throw new Error('Stale English error after switching');
  for(const locale of ['my-MM','en']){
    if(await page.locator('html').getAttribute('lang')!==locale)await toggle();
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
      for(const width of [320,390,1280]){
        await page.setViewportSize({width,height:900});await page.waitForTimeout(150);
        const metrics=await page.evaluate(()=>{
          const a=document.querySelector('.intake-v2 [role=alert]').getBoundingClientRect(),b=document.querySelector('.quiz-next').getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth-innerWidth,errorBottom:a.bottom,buttonTop:b.top,buttonHeight:b.height,numberInputs:document.querySelectorAll('.intake-v2 input[type=number]').length};
        });
        if(metrics.overflow>0||metrics.errorBottom>metrics.buttonTop||metrics.buttonHeight<44||metrics.numberInputs)throw new Error(JSON.stringify(metrics));
        await page.screenshot({path:`D:/workout_fitness/evidence/intake-save/error-${locale}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
        checks.push({locale,theme,width,...metrics});
      }
    }
  }
  await page.setViewportSize({width:390,height:900});await page.unroute('**/api/training/intake',failing);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/training/intake')&&r.request().method()==='POST');await next();const response=await saved;
  if(!response.ok())throw new Error('Actual intake save failed '+response.status()+': '+await response.text());
  await page.locator('.home-v2').waitFor({timeout:30000});
  const boot=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());
  if(boot.profile.intakeVersion!==1||boot.profile.heightCm!==170||boot.measurements[0].weightKg!==70||!boot.profile.screening.joint||boot.profile.bodyPreferences.protectedAreas.length)throw new Error('Wrong saved choices');
  await page.reload();await page.locator('.home-v2').waitFor();if(await page.locator('.intake-v2').count())throw new Error('Save lost on reload');
  // Retake in Myanmar and switch to Gym, then verify the persisted locale/location.
  if(await page.locator('html').getAttribute('lang')!=='my-MM')await toggle();
  await page.locator('.topbar .avatar').click();await page.locator('.profile-page > button.button.secondary').click();
  for(let n=0;n<19;n++){
    const step=await page.locator('.intake-v2').getAttribute('data-step');
    if(step==='review')break;
    if(step==='protected')throw new Error('Removed question returned');
    if(step==='place')await page.locator('.quiz-grid button').nth(1).click();
    if(step==='health')await page.locator('.intake-checks input').last().check();
    await next();
  }
  await at('review');await next();await page.locator('.home-v2').waitFor({timeout:30000});
  const gym=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());
  if(gym.profile.locale!=='my-MM'||gym.profile.trainingLocation!=='gym')throw new Error('Myanmar/Gym save failed');
  return {result:errors.length?'FAIL':'PASS',saveStatus:response.status(),height:170,weight:70,jointWithoutProtectedArea:true,removedScreen:true,removedCaptions:true,errorChangesLanguage:true,duplicateToast:false,reloadPersistence:true,gymLocale:gym.profile.locale,gymLocation:gym.profile.trainingLocation,checks,errors};
}
