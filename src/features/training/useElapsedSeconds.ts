import { useEffect, useState } from 'react'

export function useElapsedSeconds(startedAt: Date): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return Math.floor((now - startedAt.getTime()) / 1000)
}
