import { type FormEvent, useState } from 'react'
import { firebaseAuthRepository } from '@/data/firestore/authRepository'
import { primaryButton } from '@/app/buttonStyles'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await firebaseAuthRepository.signIn(email, password)
    } catch {
      setError('No se pudo iniciar sesión. Verifica tu correo y contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">RepEats</h1>
        <p className="mt-1 text-sm text-slate-400">Entrenamiento y nutrición</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          autoComplete="email"
          placeholder="Correo"
          aria-label="Correo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="rounded-xl bg-slate-800 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          aria-label="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="rounded-xl bg-slate-800 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {error && <p className="text-sm text-amber-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={`${primaryButton} mt-2`}
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
