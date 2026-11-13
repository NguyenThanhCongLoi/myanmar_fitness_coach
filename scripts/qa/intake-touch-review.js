async page => {
 if(!new URL(page.url()).hostname.endsWith('.w.modal.host'))throw new Error('Preview only');
 await page.locator('.quiz-top button').click();
 const slider=page.getByRole('slider'),before=Number(await slider.getAttribute('aria-valuenow'));
 const r=await slider.boundingBox(),x=r.x+r.width*.7,y=r.y+40;
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*10,y}]});await page.waitForTimeout(30);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(700);await cdp.detach();
 const after=Number(await slider.getAttribute('aria-valuenow'));if(after<=before)throw new Error('Native touch ruler did not move');
 await slider.focus();await slider.press('Home');if(await slider.getAttribute('aria-valuenow')!=='30')throw new Error('Min boundary');
 await slider.press('End');if(await slider.getAttribute('aria-valuenow')!=='250')throw new Error('Max boundary');
 return {result:'PASS',before,after,touch:'native CDP touch pan',boundaries:[30,250]};
}
