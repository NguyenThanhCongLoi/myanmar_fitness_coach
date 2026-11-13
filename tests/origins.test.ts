import { expect, test } from 'vitest';
import { allowedAppOrigin, appOrigins } from '../src/server/origins';

test('both exact Fitness Modal URLs can save, without trusting arbitrary Modal apps', () => {
  const canonical = 'https://avibigateway--myanmar-fitness-coach.modal.run';
  const regional = 'https://avibigateway--myanmar-fitness-coach.us-east.modal.run';
  expect(allowedAppOrigin(regional, canonical)).toBe(true);
  expect(allowedAppOrigin(canonical, regional)).toBe(true);
  for (const bad of ['null', 'https://another-app.modal.run', canonical + '.evil.test', 'http://avibigateway--myanmar-fitness-coach.modal.run']) expect(allowedAppOrigin(bad, canonical)).toBe(false);
  expect(allowedAppOrigin(null, canonical)).toBe(true);
});
test('other deployments keep their own exact configured origin', () => {
  expect(appOrigins('https://fitness.aibinhdan.vn/')).toEqual(['https://fitness.aibinhdan.vn']);
  expect(allowedAppOrigin('https://fitness.aibinhdan.vn', 'https://fitness.aibinhdan.vn/')).toBe(true);
  expect(allowedAppOrigin('https://avibigateway--myanmar-fitness-coach.modal.run', 'https://fitness.aibinhdan.vn')).toBe(false);
  expect(appOrigins('not a URL')).toEqual([]);
});
