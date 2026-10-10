import { useEffect, useState } from 'react'
import { disablePush, enablePush, pushCapabilities, pushStatus, type PushStatus } from './pushClient'
export function PushSettingsControl({time}:{time:string}) {
  const [status,setStatus]=useState<PushStatus|null>(null)
  const [available,setAvailable]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true
    Promise.all([pushCapabilities(),pushStatus()]).then(([config,state])=>{
      if(active){setAvailable(config.available);setStatus(state);setError('')}
    }).catch(()=>{if(active)setError('Background reminder service is unavailable. Retry when your connection and service are ready.')})
    return()=>{active=false}
  },[attempt])
  async function update(disable=false){
    if(busy)return
    setBusy(true);setError('')
    try{if(disable){await disablePush();setStatus({saved:true,enabled:false,time:null,timezone:null})}else setStatus(await enablePush(time))}
    catch(e){setError(e instanceof Error?e.message:'Could not update reminder.')}
    finally{setBusy(false)}
  }
  return <section aria-label="Background reminder delivery">
    <p>{status?.enabled?`Background reminder enabled at ${status.time} (${status.timezone}).`:status?'Background reminders are off.':'Checking background reminder status…'}</p>
    <p>Enabling sends only your device subscription, reminder time, timezone and daily completed/not-completed status to the server. Drink details stay in this browser.</p>
    <p>Reminders stay active when this site is closed. A synced check-in stops today’s reminder. Offline check-ins may not sync in time, so you may still receive a reminder. Delivery depends on your device and connection.</p>
    {!available&&<p>Background delivery is not configured or is unavailable.</p>}
    <button type="button" disabled={busy||!available||!status} onClick={()=>void update()}>{status?.enabled?'Update active reminder':'Enable background reminder'}</button>
    {status?.saved&&<button type="button" disabled={busy} onClick={()=>void update(true)}>Disable background reminder</button>}
    {error&&<p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>Refresh reminder status</button>
  </section>
}
