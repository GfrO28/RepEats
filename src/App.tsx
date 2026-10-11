import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from '@/app/BottomNav'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/features/auth/useAuth'
import { NutritionPage } from '@/features/nutrition/NutritionPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TrainingPage } from '@/features/training/TrainingPage'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-slate-500">
        Cargando…
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-dvh pb-20">
      <main>
      <Routes>
        <Route path="/entrenar" element={<TrainingPage />} />
        <Route path="/nutricion" element={<NutritionPage />} />
        <Route path="/progreso" element={<ProgressPage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/entrenar" replace />} />
      </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
