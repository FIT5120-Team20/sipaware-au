/** Ephemeral feedback only; tokens and personal records never enter this store. */
let notice:string|null=null
const listeners=new Set<()=>void>()
export function setReminderSyncNotice(value:string|null){
  if(notice===value)return
  notice=value
  listeners.forEach(listener=>listener())
}
export const getReminderSyncNotice=()=>notice
export function subscribeReminderSyncNotice(listener:()=>void){
  listeners.add(listener)
  return ()=>{listeners.delete(listener)}
}
