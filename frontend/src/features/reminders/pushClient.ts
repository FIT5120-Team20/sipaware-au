import { buildApiUrl } from '../../services/apiBaseUrl'
import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { isDailyCheckIn } from '../drinks/types/dailyCheckIn'
import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../drinks/utils/localCalendarDate'
import { isReminderTime } from './reminderPreference'
const TOKEN='sipaware.push.token.v1', ACTIVE='sipaware.push.active.v1', REVISION='sipaware.push.revision.v1'
export const PUSH_CHANGED='sipaware:push-changed'
export interface PushStatus { enabled: boolean; saved: boolean; time: string | null; timezone: string | null }
export async function reminderRequest<T>(path: string, data?: unknown): Promise<T> {
  const token=localStorage.getItem(TOKEN)
  const response=await fetch(buildApiUrl(`/api/reminders/${path}`), {
    method:data===undefined?'GET':'POST', headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:data===undefined?undefined:JSON.stringify(data), signal:AbortSignal.timeout(12000), cache:'no-store',
  })
  if (!response.ok) throw new Error(response.status===401?'Please sign in to the website again, then retry.':'Reminder service is unavailable. Please retry.')
  return await response.json() as T
}
export async function pushCapabilities() {
  return reminderRequest<{available:boolean;publicKey:string|null}>('capabilities')
}
function exclusive<T>(action:()=>Promise<T>):Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('This browser cannot safely manage background reminders.'))
  return navigator.locks.request('sipaware-push-settings',action)
}
function nextRevision() {
  const previous=Number(localStorage.getItem(REVISION)||0)
  const next=Math.max(Number.isSafeInteger(previous)?previous+1:1,Date.now()*1000)
  localStorage.setItem(REVISION,String(next)); return next
}
async function snapshot() {
  return withDailyDataLock(async()=>{
    const date=getCurrentLocalCalendarDateKey()
    const records=await (await openSipAwareDatabase()).getAll(DRINKING_RECORDS_STORE_NAME)
    const days=await (await openCheckInDatabase()).getAll('daily_checkins')
    if (records.some(r=>!isDrinkingRecord(r)) || days.some(r=>!isDailyCheckIn(r))) throw new Error('Local history could not be verified. Reminder synchronization was skipped.')
    return {date,checked_in:records.some(r=>isDrinkingRecord(r)&&getRecordLocalCalendarDateKey(r)===date)
      ||days.some(r=>isDailyCheckIn(r)&&r.kind==='alcohol-free'&&r.date===date),revision:nextRevision()}
  })
}
export async function pushStatus():Promise<PushStatus> {
  if (!localStorage.getItem(TOKEN)) return {saved:false,enabled:false,time:null,timezone:null}
  return reminderRequest<PushStatus>('status')
}
export async function enablePush(time:string) {
  if (!isReminderTime(time)) throw new Error('Choose a valid time first.')
  if (typeof Notification==='undefined'||Notification.permission!=='granted') throw new Error('Grant browser notification permission first.')
  return exclusive(async()=>{
    const config=await pushCapabilities()
    if (!config.available||!config.publicKey) throw new Error('Background delivery is not configured yet.')
    if (!localStorage.getItem(TOKEN)) {
      const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
      localStorage.setItem(TOKEN,token)
    }
    const registration=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'reminder-sw.js',{scope:import.meta.env.BASE_URL})
    await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Notification setup timed out. Please retry.')),15000))])
    const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
    const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
    const json=subscription.toJSON()
    // Persist sync intent before the request: an uncertain response must still
    // trigger retries if the server committed successfully.
    localStorage.setItem(ACTIVE,'1')
    const result=await reminderRequest<PushStatus>('enable',{endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,time,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,...await snapshot()})
    if (!result.enabled) throw new Error('Reminder was not enabled. Please retry.')
    window.dispatchEvent(new Event(PUSH_CHANGED)); return result
  })
}
export async function disablePush() {
  return exclusive(async()=>{
    await reminderRequest('disable',{revision:nextRevision()})
    localStorage.removeItem(ACTIVE)
    const registration=await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL)
    await registration?.pushManager.getSubscription().then(s=>s?.unsubscribe()).catch(()=>undefined)
    window.dispatchEvent(new Event(PUSH_CHANGED))
  })
}
export async function syncPushState() {
  if (localStorage.getItem(ACTIVE)!=='1') return
  return exclusive(async()=>{
    if (localStorage.getItem(ACTIVE)!=='1') return
    await reminderRequest('sync',await snapshot())
  })
}
