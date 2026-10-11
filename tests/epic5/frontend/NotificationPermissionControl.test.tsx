/** Permission fixtures verify user-gesture explanation, denial and refresh;
 * granting browser permission alone must not advertise scheduled delivery. */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NotificationPermissionControl } from '../../../frontend/src/features/reminders/NotificationPermissionControl'
let permission: NotificationPermission
let request: ReturnType<typeof vi.fn>
beforeEach(() => {
 permission='default'; request=vi.fn().mockResolvedValue('granted')
 vi.stubGlobal('isSecureContext',true)
 vi.stubGlobal('PushManager',class {})
 vi.stubGlobal('Notification',{get permission(){return permission},requestPermission:request})
 vi.stubGlobal('navigator', { serviceWorker: {} })
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})
it('explains before requesting and keeps reminders off after permission is granted',async()=>{
 render(<NotificationPermissionControl />)
 const user=userEvent.setup()
 expect(request).not.toHaveBeenCalled()
 await user.click(screen.getByRole('button',{name:'Set up notification permission'}))
 expect(request).not.toHaveBeenCalled()
 expect(screen.getByText(/Granting permission alone/)).toBeInTheDocument()
 await user.click(screen.getByRole('button',{name:'Continue to browser permission'}))
 expect(request).toHaveBeenCalledTimes(1)
 expect(screen.getByTestId('notification-access')).toHaveTextContent('Use the background reminder controls')
})
it('cancels without requesting permission',async()=>{
 render(<NotificationPermissionControl />); const user=userEvent.setup()
 await user.click(screen.getByRole('button',{name:'Set up notification permission'}))
 await user.click(screen.getByRole('button',{name:'Not now'}))
 expect(request).not.toHaveBeenCalled()
})
it('does not repeatedly prompt after denial',()=>{
 permission='denied';render(<NotificationPermissionControl />)
 expect(screen.getByTestId('notification-access')).toHaveTextContent('Notifications are blocked')
 expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('refreshes changed permissions when returning to the page',()=>{
 render(<NotificationPermissionControl />); permission='denied';fireEvent.focus(window)
 expect(screen.getByTestId('notification-access')).toHaveTextContent('Notifications are blocked')
})
it('explains insecure contexts',()=>{
 vi.stubGlobal('isSecureContext',false);render(<NotificationPermissionControl />)
 expect(screen.getByTestId('notification-access')).toHaveTextContent('secure HTTPS')
 expect(request).not.toHaveBeenCalled()
})
