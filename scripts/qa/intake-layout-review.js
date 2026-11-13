async page => {
  if(!new URL(page.url()).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
  const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  for(const locale of ['en','my-MM'])for(const theme of ['light','dark']) {
    await page.evaluate(({locale,theme})=>{localStorage.setItem('mingalar-locale',locale);localStorage.setItem('mingalar-theme',theme);},{locale,theme});
    await page.reload();await page.locator('.topbar .avatar').click();await page.locator('.profile-page > button.button.secondary').click();await page.locator('.intake-v2').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    // Let the finite page-entry/view-transition animation finish before visual evidence.
    await page.waitForTimeout(400);
    for(const step of ['age','height','weight']) {
      await page.locator(`.intake-v2[data-step="${step}"]`).waitFor();
      for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
        const metrics=await page.evaluate(()=>{
          const btn=document.querySelector('.quiz-next'),r=btn.getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth-innerWidth,font:getComputedStyle(document.querySelector('.intake-v2')).fontFamily,numberInputs:document.querySelectorAll('.intake-v2 input[type=number]').length,sliderCount:document.querySelectorAll('.intake-v2 [role=slider]').length,button:{width:r.width,height:r.height,bottom:r.bottom},value:document.querySelector('[role=slider]').getAttribute('aria-valuenow')};
        });
        if(metrics.overflow>0||metrics.numberInputs||metrics.sliderCount!==1||metrics.button.height<44||metrics.button.bottom>900)throw new Error(JSON.stringify({locale,theme,width,step,...metrics}));
        await page.screenshot({path:`D:/workout_fitness/evidence/intake-release/${step}-${locale}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
        checks.push({locale,theme,width,step,...metrics});
      }
      await page.locator('.quiz-next').click();
    }

  }
  return {result:errors.length?'FAIL':'PASS',checks,errors};
}
