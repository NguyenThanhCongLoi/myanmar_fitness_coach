async page=>{
  const origin=new URL(page.url()).origin;
  if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const signup=await page.request.post(origin+'/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Functional Preview',email:`functional-${Date.now()}@example.test`,password:'Disposable-functional-2026'}});
  if(!signup.ok())throw new Error('Signup '+signup.status());
  await page.evaluate(()=>{localStorage.setItem('mingalar-locale','en');localStorage.setItem('mingalar-theme','light');});
  await page.setViewportSize({width:390,height:900});await page.reload();
  const seen=[];
  for(let n=0;n<22;n++){
    await page.locator('.intake-v2').waitFor();
    const step=await page.locator('.intake-v2').getAttribute('data-step');seen.push(step);
    if(['sex','goal','level','activity','place','days','minutes','health'].includes(step)&&!await page.locator('.quiz-next').isDisabled())throw new Error('Required '+step+' enabled without answer');
    if(step==='sex')await page.locator('.quiz-grid button').nth(2).click();
    if(step==='goal')await page.locator('.quiz-grid button').nth(3).click();
    if(step==='level')await page.locator('.quiz-grid button').nth(0).click();
    if(step==='activity')await page.locator('.quiz-grid button').nth(2).click();
    if(step==='place')await page.locator('.quiz-grid button').nth(0).click();
    if(step==='days')await page.locator('.quiz-grid button').nth(1).click();
    if(step==='minutes')await page.locator('.quiz-grid button').nth(1).click();
    if(step==='health')await page.locator('.intake-checks input').last().check();
    if(step==='preferences')await page.locator('.quiz-option').first().click();
    if(['height','weight'].includes(step)){await page.getByRole('slider').focus();for(let k=0;k<(step==='height'?5:10);k++)await page.getByRole('slider').press('ArrowRight');}
    const saved=step==='review'?page.waitForResponse(r=>r.url().endsWith('/api/training/intake')&&r.request().method()==='POST'):null;
    await page.locator('.quiz-next').click();
    if(saved){const r=await saved;if(!r.ok())throw new Error('Intake '+r.status()+' '+await r.text());break;}
  }
  await page.locator('.home-v2').waitFor({timeout:30000});
  const boot=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());
  if(boot.profile.heightCm!==170||boot.measurements[0].weightKg!==70||boot.profile.limitations!=='no jumping')throw new Error('Baseline/preferences not saved');
  await page.reload();await page.locator('.home-v2').waitFor();
  const home=await page.request.get(origin+'/api/training/plan?location=home').then(r=>r.json());
  const library=await page.request.get(origin+'/api/training/exercises').then(r=>r.json());
  if(home.days.some(d=>d.items.some(i=>library.find(e=>e.id===i.id).tags.includes('jumping'))))throw new Error('Preference ignored');
  await page.screenshot({path:'D:/workout_fitness/myanmar-fitness-coach/evidence/functional-review/onboarding-home.png'});
  return {result:'PASS',steps:seen,baseline:{height:boot.profile.heightCm,weight:boot.measurements[0].weightKg,limitations:boot.profile.limitations},homeDays:home.days.map(d=>({split:d.split,minutes:d.minutes,ids:d.items.map(i=>i.id)})),errors};
}
