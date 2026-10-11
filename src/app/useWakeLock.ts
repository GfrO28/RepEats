import { useEffect } from 'react'

// Mantiene la pantalla encendida mientras "enabled" sea true (Wake Lock API). Donde no exista, o si el navegador
// lo niega (batería baja, sin permiso), no pasa nada: la pantalla se apaga como siempre.
// El navegador suelta el bloqueo solo cuando la app pasa a segundo plano, así que se vuelve a pedir al regresar.
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let isAcquiring = false
    let isCancelled = false

    async function acquire() {
      if (isAcquiring) return
      isAcquiring = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (isCancelled) {
          void lock.release() // el efecto terminó mientras se esperaba la respuesta
        } else {
          sentinel = lock
        }
      } catch {
        // denegado: se sigue sin bloqueo
      } finally {
        isAcquiring = false
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && (sentinel === null || sentinel.released)) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isCancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void sentinel?.release()
    }
  }, [enabled])
}
