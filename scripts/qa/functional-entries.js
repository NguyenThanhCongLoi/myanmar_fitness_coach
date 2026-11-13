async page=>{
  const origin=new URL(page.url()).origin;
  if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>localStorage.setItem('mingalar-location','home'));
  await page.reload();await page.locator('.home-v2').waitFor();
  const quit=async()=>{await page.locator('.player-bar > button').first().click();await page.getByRole('button',{name:'Just looking',exact:true}).click();await page.locator('.home-v2').waitFor();};
  const previews=[];
  for(const [index,minutes] of [15,20,30].entries()){
    await page.locator('.mobile-nav button').nth(1).click();
    await page.locator('.quick-card').first().waitFor();
    if(await page.locator('.quick-card').count()!==3)throw new Error('Quick choices not exactly three');
    await page.locator('.quick-card').nth(index).click();await page.locator('.wi-exercises li').first().waitFor();
    const count=await page.locator('.wi-exercises li').count(),meta=await page.locator('.wi-meta').innerText();
    previews.push({requested:minutes,count,meta});
    if(index===0){await page.locator('.start-bar-go').click();await page.locator('.minimal-player').waitFor();await quit();}
    else await page.locator('.workout-intro > button').click();
  }
  await page.locator('.hv-banner').first().click();await page.locator('.wi-exercises li').first().waitFor();const bannerCount=await page.locator('.wi-exercises li').count();await page.locator('.start-bar-go').click();await page.locator('.minimal-player').waitFor();await quit();
  await page.locator('.mobile-nav button').nth(1).click();await page.locator('[data-exercise="curated-bird-dog"]').click();
  await page.locator('.ex-set-list li').first().waitFor();const recommendationCount=await page.locator('.ex-set-list li').count();
  if(await page.locator('.detail-hero').count()!==1||await page.locator('.ex-set').count()!==1)throw new Error('Intro sections missing');
  const singleWait=page.waitForResponse(r=>r.url().endsWith('/api/training/free')&&r.request().method()==='POST');await page.locator('.ex-try').click();const single=await (await singleWait).json();
  if(single.prescriptions.length!==1||single.prescriptions[0].sets%2!==0)throw new Error('Try this is not one paired move');await page.locator('.minimal-player').waitFor();await quit();
  await page.locator('.mobile-nav button').nth(1).click();await page.locator('[data-exercise="curated-bird-dog"]').click();await page.locator('.ex-set-list li').first().waitFor();
  const setWait=page.waitForResponse(r=>r.url().endsWith('/api/training/free')&&r.request().method()==='POST');await page.locator('.start-bar-go').click();const set=await (await setWait).json();
  if(set.prescriptions.length<2)throw new Error('Recommended sequence missing');await page.locator('.minimal-player').waitFor();
  await page.screenshot({path:'D:/workout_fitness/myanmar-fitness-coach/evidence/functional-review/recommended-start.png'});await quit();
  return {result:'PASS',previews,bannerCount,recommendationCount,tryThisExercises:single.prescriptions.length,recommendedExercises:set.prescriptions.length,samePlayer:true,errors};
}
