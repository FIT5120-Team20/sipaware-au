/** Only the exact authenticated active-iteration POST can cross the website
 * gate. Other paths, methods and invalid keys keep normal access protection. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isReminderScheduler } from '../../../security/reminderScheduler.mjs';
const env={['REMINDER_CRON_SECRET']:'x'.repeat(32)};
const req=(path,deviceKey='x'.repeat(32),method='POST')=>new Request('https://example.com'+path,{method,headers:{['Authorization']:'Bearer '+deviceKey}});
test('scheduler bypass is restricted to its exact authenticated POST route',()=>{
 assert.equal(isReminderScheduler(req('/iteration3/api/reminders/dispatch'),env),true);
 for(const path of ['/','/iteration2/api/reminders/dispatch','/iteration3/api/reminders/status','/iteration3/api/reminders/dispatch/']) assert.equal(isReminderScheduler(req(path),env),false);
 assert.equal(isReminderScheduler(req('/iteration3/api/reminders/dispatch','wrong'),env),false);
 assert.equal(isReminderScheduler(req('/iteration3/api/reminders/dispatch',env.REMINDER_CRON_SECRET,'GET'),env),false);
 assert.equal(isReminderScheduler(req('/iteration3/api/reminders/dispatch'),{}),false);
});
