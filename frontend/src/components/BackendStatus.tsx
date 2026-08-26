import { useEffect, useState } from 'react'

import { getHealth } from '../services/healthApi'

type ConnectionState = 'checking' | 'connected' | 'unavailable'

const statusLabels: Record<ConnectionState, string> = {
  checking: 'Checking backend…',
  connected: 'Backend: Connected',
  unavailable: 'Backend: Unavailable',
}

export function BackendStatus() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    getHealth(controller.signal)
      .then(() => setConnectionState('connected'))
      .catch(() => {
        if (!controller.signal.aborted) {
          setConnectionState('unavailable')
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <div
      className={`backend-status backend-status--${connectionState}`}
      role="status"
      aria-live="polite"
    >
      <span className="backend-status__indicator" aria-hidden="true" />
      <span>{statusLabels[connectionState]}</span>
    </div>
  )
}
