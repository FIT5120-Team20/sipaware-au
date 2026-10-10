import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { ReminderSuggestionPrompt } from '../../../frontend/src/features/reminders/ReminderSuggestionPrompt'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { readReminderPreference, saveReminderPreference, REMINDER_PREFERENCE_KEY } from '../../../frontend/src/features/reminders/reminderPreference'
afterEach(() => localStorage.removeItem(REMINDER_PREFERENCE_KEY))
async function setup() {
 const db=await openCheckInDatabase()
 for(let i=1;i<=7;i++) { const date=`2026-01-0${i}`; await db.put('daily_checkins',{id:'day:'+date,kind:'alcohol-free',date,confirmedAt:new Date(2026,0,i,20).toISOString()}) }
 saveReminderPreference('18:00')
 render(<ReminderSuggestionPrompt onChooseTime={() => undefined} />)
 await screen.findByRole('button',{name:'Save suggested time 20:00'})
}
it('does not apply the suggestion without explicit acceptance',async()=>{
 await setup()
 expect(readReminderPreference()?.time).toBe('18:00')
 await userEvent.setup().click(screen.getByRole('button',{name:'Keep current settings'}))
 expect(readReminderPreference()?.time).toBe('18:00')
 expect(screen.queryByRole('region',{name:'Suggested reminder time'})).not.toBeInTheDocument()
})
it('acceptance saves preference but explicitly leaves notifications off',async()=>{
 await setup()
 await userEvent.setup().click(screen.getByRole('button',{name:'Save suggested time 20:00'}))
 expect(readReminderPreference()?.time).toBe('20:00')
 expect(screen.getByRole('status')).toHaveTextContent('Open reminder settings')
})
