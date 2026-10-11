// Aviso sonoro de fin de descanso, generado con Web Audio (sin archivos de audio).
// iOS solo deja iniciar el audio dentro de un toque del usuario, por eso hay que "desbloquearlo" antes,
// por ejemplo al marcar una serie: cuando termina el descanso ya no habría ningún toque.
let audioContext: AudioContext | null = null

function getAudioContextClass(): typeof AudioContext | null {
  const legacy = window as Window & { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? legacy.webkitAudioContext ?? null
}

// Llamar dentro del manejador de un toque o clic
export function unlockAudio(): void {
  try {
    const AudioContextClass = getAudioContextClass()
    if (!AudioContextClass) return
    audioContext ??= new AudioContextClass()
    if (audioContext.state === 'suspended') void audioContext.resume()
  } catch {
    // sin audio disponible: el aviso visual sigue funcionando
  }
}

const BEEP_COUNT = 3
const BEEP_INTERVAL_SECONDS = 0.28
const BEEP_LENGTH_SECONDS = 0.18
const BEEP_FREQUENCY_HZ = 880
const BEEP_VOLUME = 0.3

// Tres pitidos cortos. No hace nada si el audio nunca se desbloqueó.
export function playRestEndSound(): void {
  try {
    const context = audioContext
    if (!context || context.state === 'closed') return
    if (context.state === 'suspended') void context.resume() // al volver de segundo plano iOS lo suspende

    const startAt = context.currentTime + 0.02
    for (let beep = 0; beep < BEEP_COUNT; beep++) {
      const start = startAt + beep * BEEP_INTERVAL_SECONDS
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = BEEP_FREQUENCY_HZ
      // Subida y bajada rápidas del volumen para evitar el "clic" al empezar y terminar
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(BEEP_VOLUME, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, start + BEEP_LENGTH_SECONDS)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + BEEP_LENGTH_SECONDS + 0.02)
    }
  } catch {
    // sin audio disponible: el aviso visual sigue funcionando
  }
}

// Para el botón "Probar sonido" de Ajustes (el toque en sí desbloquea el audio)
export function playTestSound(): void {
  unlockAudio()
  playRestEndSound()
}
