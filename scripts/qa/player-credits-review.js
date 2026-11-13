async page => {
 const origin=new URL(page.url()).origin;if(!new URL(origin).hostname.endsWith('.w.modal.host'))throw new Error('Disposable preview only');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const r=await page.request.post(origin+path,{data,headers:{Origin:origin}});if(!r.ok())throw new Error(`${path}: ${r.status()}`);return r.json()};
 await post('/api/auth/sign-up/email',{name:'Media QA',email:`credits-${Date.now()}@example.test`,password:'Disposable-credits-check-2026'});
 await post('/api/fitness/profile',{locale:'en',goal:'general_fitness',experience:'beginner',equipment:['body weight'],daysPerWeek:3,limitations:'',weightUnit:'kg',distanceUnit:'km',timezone:'Asia/Yangon'});
 await post('/api/training/free',{name:'Preview media check',exercises:[{exerciseId:'dataset-0662',sets:1,reps:20,restSeconds:10,targetKg:0,timed:true}]});
 await page.evaluate(()=>{localStorage.setItem('mingalar-locale','en');localStorage.setItem('mingalar-theme','light')});await page.reload();await page.locator('.today-hero .big-start').click();await page.locator('.player-ready').waitFor();
 if(await page.locator('.player-credit').count()||await page.getByText('Image and video credits',{exact:true}).count())throw new Error('Credits remain in player');
 const checks=[];
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(overflow>0)throw new Error('Player overflow');checks.push({width,overflow});await page.screenshot({path:`D:/workout_fitness/evidence/player-no-credits-${width}.png`,fullPage:false})}
 await page.locator('.player-bar .icon-button').first().click();await page.locator('.quit-reasons button').nth(1).click();await page.locator('.adaptive-card').waitFor();
 await page.locator('.topbar .avatar').click();await page.getByRole('button',{name:'Credits & licences',exact:true}).click();await page.locator('.credits-page').waitFor();
 if(!await page.locator('.credits-page').innerText().then(t=>t.includes('CDC')||t.includes('Centers for Disease')))throw new Error('Attribution missing from dedicated page');
 return{result:errors.length?'FAIL':'PASS',playerCreditsRemoved:true,dedicatedCreditsRetained:true,pageErrors:errors,checks};
}
