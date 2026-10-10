import { useEffect } from 'react'
import { syncPushState } from './pushClient'
/** Retry by recomputing latest committed data, never by replaying old snapshots. */
export function ReminderSync() {
  useEffect(()=>{
    const sync=()=>{ void syncPushState().catch(()=>undefined) }
    const visible=()=>{ if(document.visibilityState==='visible') sync() }
    sync()
    const timer=window.setInterval(sync,60000)
    window.addEventListener('online',sync);window.addEventListener('focus',sync)
    window.addEventListener('sipaware:history-committed',sync)
    document.addEventListener('visibilitychange',visible)
    return()=>{clearInterval(timer);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);window.removeEventListener('sipaware:history-committed',sync);document.removeEventListener('visibilitychange',visible)}
  },[])
  return null
}
