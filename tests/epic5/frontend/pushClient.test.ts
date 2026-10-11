/** Exercise deduplicated minimal sync against fake IndexedDB and HTTP, plus
 * registration-specific activation; never contact an external push service. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { disablePush, syncPushState, waitForPushWorker } from '../../../frontend/src/features/reminders/pushClient'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { getCurrentLocalCalendarDateKey } from '../../../frontend/src/features/drinks/utils/localCalendarDate'

beforeEach(()=>{
  localStorage.clear()
  localStorage.setItem('sipaware.push.active.v1','1')
  localStorage.setItem('sipaware.push.token.v1','a'.repeat(43))
  vi.stubGlobal('navigator',{locks:{request:async(_name:string,action:()=>Promise<unknown>)=>action()}})
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({synced:true}))))
})
afterEach(()=>{localStorage.clear();vi.useRealTimers()})

it('sends only changed completed status, retaining no personal details in its payload',async()=>{
  await syncPushState()
  await syncPushState()
  await syncPushState()
  expect(fetch).toHaveBeenCalledTimes(1)
  const date=getCurrentLocalCalendarDateKey()
  const db=await openCheckInDatabase()
  await db.put('daily_checkins',{id:'day:'+date,kind:'alcohol-free',date,confirmedAt:new Date().toISOString()})
  await syncPushState()
  expect(fetch).toHaveBeenCalledTimes(2)
  const body=JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)
  expect(Object.keys(body).sort()).toEqual(['checked_in','date','revision'])
  expect(body.checked_in).toBe(true)
  await db.delete('daily_checkins','day:'+date)
  await syncPushState()
  expect(JSON.parse(vi.mocked(fetch).mock.calls[2][1]?.body as string).checked_in).toBe(false)
})

it('does not acknowledge a failed request and retries current state',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null,{status:503}))
  await expect(syncPushState()).rejects.toThrow('unavailable')
  expect(localStorage.getItem('sipaware.push.ack.v1')).toBeNull()
  await syncPushState()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(localStorage.getItem('sipaware.push.ack.v1')).not.toBeNull()
})

it('makes no request when disabled',async()=>{
  localStorage.removeItem('sipaware.push.active.v1')
  await syncPushState()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not clear local synchronization after an out-of-order disable',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({enabled:true})))
  await expect(disablePush()).rejects.toThrow('newer reminder')
  expect(localStorage.getItem('sipaware.push.active.v1')).toBe('1')
})

it('waits for its own registration even on a page outside the worker scope',async()=>{
  const worker=Object.assign(new EventTarget(),{state:'installing'})
  const registration={installing:worker,active:null} as unknown as ServiceWorkerRegistration
  const waiting=waitForPushWorker(registration)
  worker.state='activated';worker.dispatchEvent(new Event('statechange'))
  await expect(waiting).resolves.toBeUndefined()
})

it('rejects a failed worker and cleans up the activation timeout',async()=>{
  vi.useFakeTimers()
  const worker=Object.assign(new EventTarget(),{state:'installing'})
  const waiting=waitForPushWorker({installing:worker} as unknown as ServiceWorkerRegistration)
  const rejected=expect(waiting).rejects.toThrow('failed')
  worker.state='redundant';worker.dispatchEvent(new Event('statechange'))
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})
