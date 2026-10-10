import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PushSettingsControl } from '../../../frontend/src/features/reminders/PushSettingsControl'
import * as client from '../../../frontend/src/features/reminders/pushClient'
vi.mock('../../../frontend/src/features/reminders/pushClient',()=>({pushCapabilities:vi.fn(),pushStatus:vi.fn(),enablePush:vi.fn(),disablePush:vi.fn()}))
beforeEach(()=>{
 vi.mocked(client.pushCapabilities).mockResolvedValue({available:true,publicKey:'key'})
 vi.mocked(client.pushStatus).mockResolvedValue({saved:true,enabled:false,time:'20:00',timezone:'UTC'})
})
afterEach(()=>vi.clearAllMocks())
it('disables activation until backend is configured',async()=>{
 vi.mocked(client.pushCapabilities).mockResolvedValue({available:false,publicKey:null})
 render(<PushSettingsControl time="20:00" />)
 await screen.findByText('Background reminders are off.')
 expect(screen.getByRole('button',{name:'Enable background reminder'})).toBeDisabled()
})
it('shows enabled only after the backend confirms it',async()=>{
 vi.mocked(client.enablePush).mockResolvedValue({saved:true,enabled:true,time:'20:00',timezone:'UTC'})
 render(<PushSettingsControl time="20:00" />)
 await screen.findByText('Background reminders are off.')
 await userEvent.setup().click(screen.getByRole('button',{name:'Enable background reminder'}))
 expect(await screen.findByText('Background reminder enabled at 20:00 (UTC).')).toBeInTheDocument()
})
it('does not claim activation on network failure',async()=>{
 vi.mocked(client.enablePush).mockRejectedValue(new Error('Network failed'))
 render(<PushSettingsControl time="20:00" />)
 await screen.findByText('Background reminders are off.')
 fireEvent.click(screen.getByRole('button',{name:'Enable background reminder'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Network failed')
 expect(screen.getByText('Background reminders are off.')).toBeInTheDocument()
})
it('does not claim disable succeeded if the request failed',async()=>{
 vi.mocked(client.pushStatus).mockResolvedValue({saved:true,enabled:true,time:'20:00',timezone:'UTC'})
 vi.mocked(client.disablePush).mockRejectedValue(new Error('Offline'))
 render(<PushSettingsControl time="20:00" />)
 await screen.findByText('Background reminder enabled at 20:00 (UTC).')
 await userEvent.setup().click(screen.getByRole('button',{name:'Disable background reminder'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
 expect(screen.getByText('Background reminder enabled at 20:00 (UTC).')).toBeInTheDocument()
})
