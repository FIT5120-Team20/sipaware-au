import { expect, it } from 'vitest'
import { suggestReminder } from '../../../frontend/src/features/reminders/reminderSuggestion'
function rows(times: string[]) {
 return times.map((time, index) => { const date = `2026-01-${String(index + 1).padStart(2, '0')}`; return { id: 'day:' + date, kind: 'alcohol-free', date, confirmedAt: new Date(date + 'T' + time + ':00').toISOString() } })
}
const now = new Date(2026, 2, 1)
it('requires seven different creation days', () => { expect(suggestReminder([], rows(Array(6).fill('20:00')), now)).toBeNull() })
it('finds a clear pattern and median', () => { expect(suggestReminder([], rows(Array(7).fill('20:00')), now)).toEqual({time:'20:00', matchingDays:7,totalDays:7}) })
it('rejects scattered history', () => { expect(suggestReminder([], rows(['00:00','03:00','06:00','09:00','12:00','15:00','18:00']), now)).toBeNull() })
it('accepts exactly seventy percent', () => { expect(suggestReminder([],rows([...Array(7).fill('20:00'),'03:00','06:00','09:00']),now)?.matchingDays).toBe(7) })
it('rejects below seventy percent', () => { expect(suggestReminder([],rows([...Array(6).fill('20:00'),'03:00','06:00','09:00','12:00']),now)).toBeNull() })
it('handles windows crossing midnight', () => { expect(suggestReminder([],rows(['23:30','23:45','00:00','00:15','00:30','23:50','00:10']),now)?.time).toBe('00:00') })
it('backfilling seven dates today counts only one creation day', () => { const data=rows(Array(7).fill('20:00')).map(row=>({...row,confirmedAt:new Date(2026,0,20,20).toISOString()})); expect(suggestReminder([],data,now)).toBeNull() })
it('uses the first check-in per day regardless of input order', () => { const early=rows(Array(7).fill('18:00')); const late=rows(Array(7).fill('23:00')); expect(suggestReminder([], [...late,...early],now)?.time).toBe('18:00') })
it('ignores future and invalid rows', () => { expect(suggestReminder([], [...rows(Array(6).fill('20:00')),null,{kind:'tracking-start'}, {id:'day:2027-01-01',kind:'alcohol-free',date:'2027-01-01',confirmedAt:'2027-01-01T20:00:00Z'}],now)).toBeNull() })
