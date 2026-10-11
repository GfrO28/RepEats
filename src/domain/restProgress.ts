// Fracción del descanso ya transcurrida, de 0 (recién empieza) a 1 (terminó)
export function calculateRestProgress(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0
  const progress = 1 - remainingSeconds / totalSeconds
  return Math.min(Math.max(progress, 0), 1)
}
