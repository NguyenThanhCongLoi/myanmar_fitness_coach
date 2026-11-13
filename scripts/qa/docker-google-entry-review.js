async page => {
  if (new URL(page.url()).origin !== 'https://fitness.aibinhdan.vn') throw new Error('Expected Fitness');
  await page.locator('.google-login').click();
  await page.waitForURL(url => url.hostname === 'accounts.google.com', {timeout: 30000});
  await page.locator('body').waitFor();
  const text = await page.locator('body').innerText();
  const url = new URL(page.url());
  // No account login or consent, and no OAuth state/client IDs in the report.
  return {host: url.hostname, path: url.pathname, redirectMismatch: text.includes('redirect_uri_mismatch'),
    invalidClient: text.includes('invalid_client'), title: await page.title(), completedLogin: 'NOT TESTED'};
}
