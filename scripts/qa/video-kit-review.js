async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!page.url().startsWith('http://127.0.0.1:8767/'))throw new Error('Local kit preview only');
 if(await page.locator('article').count()!==62)throw new Error('Catalog count');
 const decoded=await page.locator('img').evaluateAll(async images=>{for(const i of images)i.loading='eager';return Promise.all(images.map(async i=>{await i.decode();return{src:i.getAttribute('src'),width:i.naturalWidth}}))});
 if(decoded.length!==90||decoded.some(i=>!i.width))throw new Error('Image decoding failed');
 const groups=[];
 for(const [group,n] of [['home',35],['gym',27],['missing',18],['all',62]]){
  await page.locator(`[data-filter=${group}]`).click();const count=await page.locator('article:visible').count();if(count!==n)throw new Error(`${group}: ${count}`);groups.push({group,count});
 }
 await page.getByRole('textbox',{name:'Tìm bài tập'}).fill('dataset-0276');if(await page.locator('article:visible').count()!==1)throw new Error('ID search failed');
 await page.getByRole('textbox',{name:'Tìm bài tập'}).fill('');
 const sizes=[];for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow>0)throw new Error(`Overflow ${width}/${overflow}`);sizes.push({width,overflow});await page.screenshot({path:`D:/workout_fitness/evidence/video-kit-${width}.png`,fullPage:false})}
 return{result:errors.length?'FAIL':'PASS',images:decoded.length,groups,sizes,pageErrors:errors};
}
