import { NavLink } from 'react-router-dom'
import { TrainingIcon, NutritionIcon, ProgressIcon, SettingsIcon } from './icons'

const TABS = [
  { to: '/entrenar', label: 'Entrenar', Icon: TrainingIcon },
  { to: '/nutricion', label: 'Nutrición', Icon: NutritionIcon },
  { to: '/progreso', label: 'Progreso', Icon: ProgressIcon },
  { to: '/ajustes', label: 'Ajustes', Icon: SettingsIcon },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-800 bg-slate-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              isActive ? 'text-primary' : 'text-slate-400'
            }`
          }
        >
          <tab.Icon className="h-6 w-6" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
