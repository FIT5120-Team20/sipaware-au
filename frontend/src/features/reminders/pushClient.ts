import { setReminderSyncNotice } from './reminderSyncState'
import { buildApiUrl } from '../../services/apiBaseUrl'
import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { isDailyCheckIn } from '../drinks/types/dailyCheckIn'
import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../drinks/utils/localCalendarDate'
import { isReminderTime } from './reminderPreference'
const DEVICE_KEY_STORAGE='sipaware.push.token.v1', ACTIVE='sipaware.push.active.v1', REVISION='sipaware.push.revision.v1', ACK='sipaware.push.ack.v1'
export const PUSH_CHANGED='sipaware:push-changed'
export interface PushStatus { enabled: boolean; saved: boolean; time: string | null; timezone: string | null; needs_attention?: boolean; next_due_at?: string | null }
export class ReminderRequestError extends Error {
  constructor(message:string, public readonly retryable:boolean) { super(message) }
}
export async function reminderRequest<T>(path: string, data?: unknown): Promise<T> {
  const deviceKey=localStorage.getItem(DEVICE_KEY_STORAGE)
  const response=await fetch(buildApiUrl(`/api/reminders/${path}`), {
    method:data===undefined?'GET':'POST', headers:{'Content-Type':'application/json',...(deviceKey?{['Authorization']:'Bearer '+deviceKey}:{})},
    body:data===undefined?undefined:JSON.stringify(data), signal:AbortSignal.timeout(12000), cache:'no-store',
  })
  if (!response.ok) throw new ReminderRequestError(response.status===401?'Please sign in to the website again, then retry.':'Reminder service is unavailable. Please retry.',response.status===429||response.status>=500)
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
      ||days.some(r=>isDailyCheckIn(r)&&r.kind==='alcohol-free'&&r.date===date)}
  })
}
export async function pushStatus():Promise<PushStatus> {
  if (!localStorage.getItem(DEVICE_KEY_STORAGE)) return {saved:false,enabled:false,time:null,timezone:null}
  return reminderRequest<PushStatus>('status')
}
/** Wait for this registration itself: /iteration3 without a trailing slash may
 * be outside its scope, so navigator.serviceWorker.ready can wait forever. */
export function waitForPushWorker(registration:ServiceWorkerRegistration):Promise<void> {
  if(registration.active?.state==='activated') return Promise.resolve()
  return new Promise((resolve,reject)=>{
    const worker=registration.installing??registration.waiting??registration.active
    if(!worker){reject(new Error('Notification worker could not start. Please retry.'));return}
    const finish=(error?:Error)=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);if(error)reject(error);else resolve()}
    const changed=()=>{if(worker.state==='activated')finish();else if(worker.state==='redundant')finish(new Error('Notification setup failed. Please retry.'))}
    const timer=setTimeout(()=>finish(new Error('Notification setup timed out. Please retry.')),15000)
    worker.addEventListener('statechange',changed);changed()
  })
}
export async function enablePush(time:string) {
  if (!isReminderTime(time)) throw new Error('Choose a valid time first.')
  if (typeof Notification==='undefined'||Notification.permission!=='granted') throw new Error('Grant browser notification permission first.')
  return exclusive(async()=>{
    const config=await pushCapabilities()
    if (!config.available||!config.publicKey) throw new Error('Background delivery is not configured yet.')
    if (!localStorage.getItem(DEVICE_KEY_STORAGE)) {
      const deviceKey=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
      localStorage.setItem(DEVICE_KEY_STORAGE,deviceKey)
    }
    const registration=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'reminder-sw.js',{scope:import.meta.env.BASE_URL})
    await waitForPushWorker(registration)
    const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
    const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
    const json=subscription.toJSON()
    // Persist sync intent before the request: an uncertain response must still
    // trigger retries if the server committed successfully.
    localStorage.setItem(ACTIVE,'1')
    localStorage.removeItem(ACK)
    const state=await snapshot()
    const result=await reminderRequest<PushStatus>('enable',{endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,time,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,...state,revision:nextRevision()})
    if (!result.enabled) throw new Error('Reminder was not enabled. Please retry.')
    localStorage.setItem(ACK,JSON.stringify(state))
    setReminderSyncNotice(null)
    window.dispatchEvent(new Event(PUSH_CHANGED)); return result
  })
}
export async function disablePush() {
  return exclusive(async()=>{
    const result=await reminderRequest<PushStatus>('disable',{revision:nextRevision()})
    if(result.enabled||result.needs_attention) throw new Error('A newer reminder setting is active. Refresh status and retry.')
    localStorage.removeItem(ACTIVE)
    localStorage.removeItem(ACK)
    setReminderSyncNotice(null)
    const registration=await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL)
    await registration?.pushManager.getSubscription().then(s=>s?.unsubscribe()).catch(()=>undefined)
    window.dispatchEvent(new Event(PUSH_CHANGED))
  })
}
/** Event-triggered only; ACK is written after success, so failures remain retryable. */
export async function syncPushState() {
  if (localStorage.getItem(ACTIVE)!=='1') return
  return exclusive(async()=>{
    if (localStorage.getItem(ACTIVE)!=='1') return
    const state=await snapshot()
    const stamp=JSON.stringify(state)
    if(localStorage.getItem(ACK)===stamp) return
    await reminderRequest('sync',{...state,revision:nextRevision()})
    localStorage.setItem(ACK,stamp)
  })
}
