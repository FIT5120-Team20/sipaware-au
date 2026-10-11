/** Isolated worker harness checks generic notification and fixed navigation;
 * payload URLs never control navigation and retained pages are not cached. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
test('worker shows a generic notification and ignores payload navigation URLs', async()=>{
 const handlers={}, shown=[],opened=[];
 const self={addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(readFileSync(new URL('../../../frontend/public/reminder-sw.js',import.meta.url),'utf8'),{self});
 let work;
 handlers.push({data:{json:()=>({url:'https://evil.test'})},waitUntil:p=>work=p});await work;
 assert.equal(shown[0][0],'SipAware daily check-in');
 assert.equal(shown[0][1].data.url,'/iteration3#todays-check-in');
 let closed=false;
 handlers.notificationclick({notification:{close:()=>closed=true,data:{url:'https://evil.test'}},waitUntil:p=>work=p});await work;
 assert.equal(closed,true);assert.deepEqual(opened,['/iteration3#todays-check-in']);
 assert.equal(handlers.fetch,undefined);
});
