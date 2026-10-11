import { chip } from './buttonStyles'

interface TabBarProps<Id extends string> {
  label: string // qué agrupan las pestañas, para lectores de pantalla ("Secciones de Nutrición")
  tabs: readonly { id: Id; label: string }[]
  value: Id
  onChange: (id: Id) => void
}

// Fila de pestañas de una sección (Diario / Alimentos / Peso / Plan, etc.). Si no caben, pasan a la línea siguiente.
export function TabBar<Id extends string>({ label, tabs, value, onChange }: TabBarProps<Id>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2 px-4 pt-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={chip(value === tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
