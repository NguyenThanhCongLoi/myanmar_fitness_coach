async page => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  const results = [];
  const check = async name => {
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { await Promise.all([document.fonts.load('700 20px SUSE', 'Mingalar Fit'), document.fonts.load('400 16px "Open Sans"', 'Exercise'), document.fonts.load('400 16px "Noto Sans Myanmar"', 'မြန်မာ')]); });
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      font: getComputedStyle(document.querySelector('h1') || document.body).fontFamily,
      ink: getComputedStyle(document.body).color,
      background: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.dataset.theme,
      language: document.documentElement.lang,
      fontsLoaded: { heading: document.fonts.check('700 20px SUSE', 'Mingalar Fit'), body: document.fonts.check('400 16px "Open Sans"', 'Exercise'), myanmar: document.fonts.check('400 16px "Noto Sans Myanmar"', 'မြန်မာ') },
    }));
    await page.screenshot({ path: `evidence/solaris-${name}.png`, fullPage: true });
    results.push({ name, ...result });
    if (result.overflow > 0) throw new Error(`${name}: overflow ${result.overflow}`);
    if (Object.values(result.fontsLoaded).some(v => !v)) throw new Error(`${name}: font not loaded`);
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const locale of ['en', 'my-MM']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(({ locale, theme }) => { localStorage.setItem('mingalar-locale', locale); localStorage.setItem('mingalar-theme', theme); }, { locale, theme });
      await page.reload(); await page.locator('.plan-view').waitFor();
      await page.setViewportSize({ width: 390, height: 844 }); await check(`home-${locale}-${theme}-390`);
      for (let i = 1; i < 5; i++) {
        await page.locator('.mobile-nav button').nth(i).click();
        await check(`tab${i}-${locale}-${theme}-390`);
      }
      await page.locator('.mobile-nav button').first().click();
      await page.locator('.plan-view').waitFor();
      await page.setViewportSize({ width: 320, height: 740 }); await check(`home-${locale}-${theme}-320`);
      await page.setViewportSize({ width: 1440, height: 1000 }); await check(`home-${locale}-${theme}-1440`);
    }
  }
  return { result: errors.length ? 'FAIL' : 'PASS', reducedMotion: true, pageErrors: errors, checks: results };
}
