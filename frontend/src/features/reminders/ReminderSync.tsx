import { useEffect, useSyncExternalStore } from 'react'
import { PUSH_CHANGED, ReminderRequestError, syncPushState } from './pushClient'
import { getReminderSyncNotice, setReminderSyncNotice, subscribeReminderSyncNotice } from './reminderSyncState'
import './reminderSettings.css'
const RETRY_EVENT='sipaware:retry-reminder-sync'
const RETRY_DELAYS=[1000,5000,30000,120000]
/** Local changes, reconnects and midnight trigger a deduplicated sync. Failed
 * requests get bounded retries; there is no cloud-querying heartbeat. Every
 * attempt recomputes committed history rather than replaying an old snapshot. */
export function ReminderSync() {
  const notice=useSyncExternalStore(subscribeReminderSyncNotice,getReminderSyncNotice,()=>null)
  useEffect(()=>{
    let stopped=false,running=false,again=false,failures=0
    let retry:number|undefined,midnight:number|undefined
    const attempt=async()=>{
      if(stopped)return
      if(running){again=true;return}
      running=true
      try{await syncPushState();if(!stopped){failures=0;setReminderSyncNotice(null)}}
      catch(error){
        if(!stopped){
          const detail=error instanceof Error?error.message:'Please check your connection and retry.'
          setReminderSyncNotice('Reminder status has not synced. You may still receive today’s reminder. '+detail)
          if(!(error instanceof ReminderRequestError)||error.retryable){
            if(failures<RETRY_DELAYS.length)retry=window.setTimeout(()=>{void attempt()},RETRY_DELAYS[failures++])
          }
        }
      }
      finally{running=false;if(again&&!stopped){again=false;clearTimeout(retry);void attempt()}}
    }
    const sync=()=>{clearTimeout(retry);failures=0;void attempt()}
    const visible=()=>{if(document.visibilityState==='visible')sync()}
    const nextDay=()=>{
      const next=new Date();next.setHours(24,0,1,0)
      midnight=window.setTimeout(()=>{sync();nextDay()},next.getTime()-Date.now())
    }
    sync();nextDay()
    window.addEventListener('online',sync);window.addEventListener('focus',sync)
    window.addEventListener('sipaware:history-committed',sync);window.addEventListener(PUSH_CHANGED,sync)
    window.addEventListener(RETRY_EVENT,sync);document.addEventListener('visibilitychange',visible)
    return()=>{stopped=true;clearTimeout(retry);clearTimeout(midnight);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);window.removeEventListener('sipaware:history-committed',sync);window.removeEventListener(PUSH_CHANGED,sync);window.removeEventListener(RETRY_EVENT,sync);document.removeEventListener('visibilitychange',visible)}
  },[])
  return notice?<aside className="reminder-sync-notice" aria-label="Reminder synchronization"><p role="status">{notice}</p><button type="button" onClick={()=>window.dispatchEvent(new Event(RETRY_EVENT))}>Retry reminder sync</button></aside>:null
}
