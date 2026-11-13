async page => {
  const origin = 'https://fitness.aibinhdan.vn';
  if (new URL(page.url()).origin !== origin) throw new Error('Expected the Fitness domain');
  // Read-only public checks: never create accounts on the clean production DB.
  const pageErrors = [], failedResponses = [], checks = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      failedResponses.push({path: new URL(response.url()).pathname, status: response.status()});
  });
  for (const locale of ['my-MM', 'en']) {
    await page.evaluate(locale => {
      localStorage.setItem('mingalar-locale', locale);
      localStorage.setItem('mingalar-theme', 'light');
    }, locale);
    await page.reload();
    await page.locator('.auth-page').waitFor();
    await page.waitForFunction(() => !document.querySelector('.google-login')?.disabled);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({width, height: 900});
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        heroText: document.querySelector('.auth-hero h1')?.textContent,
        font: getComputedStyle(document.querySelector('.auth-form-panel')).fontFamily,
      }));
      if (metrics.overflow > 0) throw new Error(`${locale} ${width}: horizontal overflow`);
      checks.push({locale, width, ...metrics});
      await page.screenshot({path: `D:/workout_fitness/evidence/docker-deployment/login-${locale}-${width}.png`, fullPage: true});
    }
  }
  const result = {result: pageErrors.length || failedResponses.length ? 'FAIL' : 'PASS', pageErrors, failedResponses, checks};
  if (result.result !== 'PASS') throw new Error(JSON.stringify(result));
  return result;
}
