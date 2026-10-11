// src/features/training/useRemainingSeconds.ts
import { useCallback, useSyncExternalStore } from 'react'

const NO_OP = () => {}

// Segundos que faltan para "endsAt". Siempre se calcula contra la hora real (nunca contando ticks): iOS suspende
// la PWA en segundo plano y los ticks se pierden, pero la hora de fin sigue siendo correcta.
//
// El reloj se lee como una fuente externa: en cada render se pregunta la hora en ese instante, así que el valor
// nunca puede estar "viejo" (antes, al empezar un descanso se veía 3:10 en vez de 3:00 hasta el primer tic).
// El intervalo solo sirve para pedirle a React que vuelva a leerlo cada segundo, y solo corre mientras hay descanso.
export function useRemainingSeconds(endsAt: Date | null): number {
  // Se usa el instante (número), no el objeto: un Date nuevo con la misma hora no cuenta como cambio
  const endsAtMs = endsAt ? endsAt.getTime() : null

  const subscribe = useCallback(
    (onTick: () => void) => {
      if (endsAtMs === null) return NO_OP
      const interval = setInterval(onTick, 1000)
      return () => clearInterval(interval)
    },
    [endsAtMs],
  )

  const getRemaining = () => (endsAtMs === null ? 0 : Math.max(Math.ceil((endsAtMs - Date.now()) / 1000), 0))

  return useSyncExternalStore(subscribe, getRemaining)
}
