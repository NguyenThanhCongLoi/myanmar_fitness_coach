async page=>{
  const origin=new URL(page.url()).origin;if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  await page.reload();await page.locator('.home-v2').waitFor();await page.locator('.topbar .avatar').click();await page.locator('.profile-page > button.button.secondary').click();
  const seen=[];let equipmentRequired=false;
  for(let n=0;n<24;n++){
    await page.locator('.intake-v2').waitFor();const step=await page.locator('.intake-v2').getAttribute('data-step');seen.push(step);
    if(step==='place')await page.locator('.quiz-grid button').nth(1).click();
    if(step==='equipment'){
      equipmentRequired=await page.locator('.quiz-next').isDisabled();if(!equipmentRequired)throw new Error('Assumed full Gym equipment');
      await page.locator('.quiz-option').first().click();await page.getByRole('button',{name:'Language',exact:true}).click();
      if(await page.locator('html').getAttribute('lang')!=='my-MM')throw new Error('Language did not switch');
      await page.screenshot({path:'D:/workout_fitness/myanmar-fitness-coach/evidence/functional-review/gym-equipment-my.png'});
      const text=await page.locator('.quiz-title').innerText();if(text.includes('?'))throw new Error('Broken Myanmar characters');
      await page.getByRole('button',{name:'Language',exact:true}).click();
    }
    if(step==='health')await page.locator('.intake-checks input').last().check();
    const wait=step==='review'?page.waitForResponse(r=>r.url().endsWith('/api/training/intake')&&r.request().method()==='POST'):null;
    await page.locator('.quiz-next').click();if(wait){const r=await wait;if(!r.ok())throw new Error('Save '+await r.text());break;}
  }
  await page.locator('.home-v2').waitFor();const boot=await page.request.get(origin+'/api/fitness/bootstrap').then(r=>r.json());
  if(JSON.stringify(boot.profile.equipment)!==JSON.stringify(['body weight','machine']))throw new Error('Wrong equipment persisted');
  const plan=await page.request.get(origin+'/api/training/plan?location=gym').then(r=>r.json());
  const lib=await page.request.get(origin+'/api/training/exercises').then(r=>r.json());
  if(plan.days.some(d=>d.items.some(i=>lib.find(e=>e.id===i.id).equipment.some(q=>!['body weight','machine'].includes(q)))))throw new Error('Unselected Gym equipment leaked');
  return {result:'PASS',equipmentRequired,steps:seen,equipment:boot.profile.equipment,days:plan.days.map(d=>({split:d.split,ids:d.items.map(i=>i.id)}))};
}
