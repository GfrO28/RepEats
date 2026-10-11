import { firebaseAuthRepository } from '@/data/firestore/authRepository'
import { useAuth } from '@/features/auth/useAuth'
import { useThemePreference } from '@/app/useThemePreference'
import { KEEP_AWAKE_KEY, REST_SOUND_KEY, useBooleanPreference } from '@/app/devicePreferences'
import { playTestSound } from '@/app/restSound'
import { THEME_PREFERENCES, THEME_PREFERENCE_LABELS } from '@/domain/theme'
import { BackupSection } from './BackupSection'
import { chip, linkButton, secondaryButton } from '@/app/buttonStyles'


// Interruptor de sí/no con la misma apariencia que los demás selectores de Ajustes
function OnOffChips({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="mt-2 flex gap-2" role="radiogroup" aria-label={label}>
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={chip(value === option)}
        >
          {option ? 'Activado' : 'Desactivado'}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const [themePreference, setThemePreference] = useThemePreference()
  const [restSound, setRestSound] = useBooleanPreference(REST_SOUND_KEY, true)
  const [keepAwake, setKeepAwake] = useBooleanPreference(KEEP_AWAKE_KEY, true)
  const isWakeLockSupported = 'wakeLock' in navigator

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      {user?.email && <p className="mt-2 text-sm text-slate-400">Sesión: {user.email}</p>}

      <div className="mt-6">
        <p className="text-xs uppercase text-slate-500">Apariencia</p>
        <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Tema de la aplicación">
          {THEME_PREFERENCES.map((preference) => (
            <button
              key={preference}
              type="button"
              role="radio"
              aria-checked={themePreference === preference}
              onClick={() => setThemePreference(preference)}
              className={chip(themePreference === preference)}
            >
              {THEME_PREFERENCE_LABELS[preference]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Automático sigue el modo claro u oscuro de tu teléfono. Se guarda solo en este dispositivo.
        </p>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase text-slate-500">Durante el entrenamiento</p>

        <p className="mt-3 text-sm font-medium">Sonido al terminar el descanso</p>
        <OnOffChips label="Sonido al terminar el descanso" value={restSound} onChange={setRestSound} />
        <button type="button" onClick={playTestSound} className={`${linkButton} mt-2`}>
          Probar sonido
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Suena solo con la app abierta y la pantalla encendida: el iPhone suspende las apps en segundo plano y no permite
          avisos programados. El recuadro del descanso también se pone verde al terminar.
        </p>

        <p className="mt-4 text-sm font-medium">Mantener la pantalla encendida</p>
        <OnOffChips label="Mantener la pantalla encendida" value={keepAwake} onChange={setKeepAwake} />
        <p className="mt-1 text-xs text-slate-500">
          {isWakeLockSupported
            ? 'Mientras tienes una sesión abierta, para que el temporizador siga a la vista. Gasta un poco más de batería.'
            : 'Tu navegador no permite mantener la pantalla encendida, así que esta opción no tendrá efecto.'}
        </p>
        <p className="mt-2 text-xs text-slate-500">Estas opciones se guardan solo en este dispositivo.</p>
      </div>

      <BackupSection />

      <button
        type="button"
        onClick={() => firebaseAuthRepository.signOut()}
        className={`${secondaryButton} mt-6`}
      >
        Cerrar sesión
      </button>
    </section>
  )
}
