// Si el descanso terminó hace más que esto cuando la app lo nota (p. ej. al volver de segundo plano), el aviso
// ya no sirve: sonaría fuera de tiempo. En iOS la PWA se suspende, así que esto pasa con frecuencia.
export const REST_END_ALERT_GRACE_MS = 5000

// Cuánto se sigue mostrando "¡Descanso terminado!" antes de ocultar el recuadro del descanso
export const REST_BANNER_HIDE_AFTER_MS = 3000

// Milisegundos que faltan para ocultar el recuadro (0 si ya toca ocultarlo). Se calcula contra la hora de fin y
// no contando el tiempo desde que terminó: si la app estuvo suspendida, al volver se oculta enseguida.
export function getRestBannerHideDelayMs(endsAt: Date, now: Date): number {
  return Math.max(0, endsAt.getTime() + REST_BANNER_HIDE_AFTER_MS - now.getTime())
}

// ¿Toca avisar que terminó el descanso? Solo cuando se ve pasar de "queda tiempo" a "terminó", y hace poco.
// previousRemaining es null cuando no había un descanso en curso en la comprobación anterior.
export function shouldAlertRestEnd(
  previousRemainingSeconds: number | null,
  remainingSeconds: number,
  endsAt: Date | null,
  now: Date,
): boolean {
  if (endsAt === null || previousRemainingSeconds === null) return false
  if (previousRemainingSeconds <= 0 || remainingSeconds > 0) return false
  return now.getTime() - endsAt.getTime() <= REST_END_ALERT_GRACE_MS
}
