/** Boundary regression tests: opening root must not open retained namespaces.
 * Tests use synthetic requests; no live credentials or personal data are used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresClassroomAccess } from '../../security/channelAccess.mjs';

const request = path => new Request('https://sipaware.test' + path);

test('root pages, assets and normal APIs do not require classroom login', () => {
  for (const path of ['/', '/record', '/awards', '/trends', '/recording-reminder',
    '/alcohol-guidelines?topic=1', '/assets/app.js', '/reminder-sw.js',
    '/api/health', '/api/reminders/status', '/api/ocr']) {
    assert.equal(requiresClassroomAccess(request(path)), false, path);
  }
});

test('retained iteration pages, assets, APIs and login remain protected', () => {
  for (const path of ['/iteration1', '/iteration2/', '/iteration3',
    '/iteration3/awards', '/iteration3/assets/app.js',
    '/iteration3/api/reminders/dispatch', '/iteration10/record', '/access', '/access/']) {
    assert.equal(requiresClassroomAccess(request(path)), true, path);
  }
});

test('encoded or malformed reserved paths cannot select public root access', () => {
  for (const path of ['/%69teration3', '/iteration3%2fapi/health',
    '/iteration3%5cassets/app.js', '/%61ccess', '/iteration3/%zz', '/bad%']) {
    assert.equal(requiresClassroomAccess(request(path)), true, path);
  }
});

test('lookalike root names and query text do not change namespace ownership', () => {
  for (const path of ['/iteration3-guide', '/accessibility', '/?returnTo=/iteration3']) {
    assert.equal(requiresClassroomAccess(request(path)), false, path);
  }
});
