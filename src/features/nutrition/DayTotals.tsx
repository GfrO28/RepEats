import { useId, type SVGProps } from 'react'
import type { NutritionValues } from '@/domain/foodNutrition'
import type { Macros } from '@/domain/nutritionGoals'
import { calculateProgressRatio } from '@/domain/foodNutrition'
import { calculateCalorieMargin, type CalorieMarginZone } from '@/domain/calorieMargin'
import { kcalText, proteinText, fatText, carbsText } from '@/app/macroStyles'

interface DayTarget {
  kcal: number
  macros: Macros
}

interface DayTotalsProps {
  totals: NutritionValues
  target: DayTarget | null
  tdee: number // gasto de mantenimiento: define dónde empieza el rojo del velocímetro (ver CalorieGauge)
  exerciseKcal?: number // estimación de lo gastado entrenando ese día: solo informativa
}

interface BarRowProps {
  label: string
  consumed: number
  target: number | null
  unit: string
  valueClass: string // color del número y de la barra: distingue de un vistazo qué dato es cada uno
  barClass: string
}

// Barra sin colores de alarma: al superar el objetivo simplemente queda llena
function BarRow({ label, consumed, target, unit, valueClass, barClass }: BarRowProps) {
  const ratio = target === null ? 0 : calculateProgressRatio(consumed, target)

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={valueClass}>
          {Math.round(consumed)}
          {target !== null && ` / ${Math.round(target)}`} {unit}
        </span>
      </div>
      {target !== null && (
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
    </div>
  )
}

// La aguja y las pistas usan las variables CSS de color (no un hex fijo) para respetar el tema oscuro/claro,
// igual que las clases bg-emerald-400/etc. del resto de la app (ver @theme inline en src/index.css)
const MARGIN_VAR: Record<CalorieMarginZone, string> = {
  onTrack: 'var(--emerald-400)',
  close: 'var(--amber-400)',
  over: 'var(--red-400)',
}

// Geometría del velocímetro: un semicírculo de 0 a un "techo" (ver gaugeMax en CalorieGauge) que SIEMPRE deja
// el último 1/1.15 ≈ 13 % del arco como zona roja, sin importar los valores reales de objetivo y TDEE.
const GAUGE_CX = 140
const GAUGE_CY = 132
const GAUGE_TRACK_R = 108 // radio del arco
const GAUGE_NEEDLE_R = 94 // la aguja es un poco más corta que el arco, para no salirse
const GAUGE_TICK_IN_R = 100 // las marcas numeradas cruzan el arco...
const GAUGE_TICK_OUT_R = 118 // ...de dentro hacia afuera
const GAUGE_LABEL_R = 134 // los números de la escala, más afuera todavía
const GAUGE_HEADROOM = 1.15 // cuánto más allá del techo real (objetivo o TDEE, el mayor) llega la escala

// -180° (extremo izquierdo, 0 de la escala) a 0° (extremo derecho, el techo de la escala)
function angleForRatio(ratio: number) {
  return -180 + 180 * Math.min(Math.max(ratio, 0), 1)
}

function pointAt(ratio: number, radius: number) {
  const angleRad = (angleForRatio(ratio) * Math.PI) / 180
  return { x: GAUGE_CX + radius * Math.cos(angleRad), y: GAUGE_CY + radius * Math.sin(angleRad) }
}

// Paso "redondo" entre marcas numeradas, según qué tan grande sea la escala completa
function pickTickStep(gaugeMax: number) {
  if (gaugeMax <= 1200) return 200
  if (gaugeMax <= 2400) return 400
  if (gaugeMax <= 4000) return 500
  return 1000
}

interface GaugeTickMark {
  value: number
  x1: number
  y1: number
  x2: number
  y2: number
  lx: number
  ly: number
}

function buildTicks(gaugeMax: number): GaugeTickMark[] {
  const step = pickTickStep(gaugeMax)
  const ticks: GaugeTickMark[] = []
  for (let value = 0; value <= gaugeMax + 1; value += step) {
    const ratio = value / gaugeMax
    const inner = pointAt(ratio, GAUGE_TICK_IN_R)
    const outer = pointAt(ratio, GAUGE_TICK_OUT_R)
    const label = pointAt(ratio, GAUGE_LABEL_R)
    ticks.push({ value: Math.round(value), x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, lx: label.x, ly: label.y })
  }
  return ticks
}

// Marca de referencia (objetivo o TDEE): una línea un poco más larga que las de la escala, para distinguirla
function ReferenceTick({ ratio, ...lineProps }: { ratio: number } & Omit<SVGProps<SVGLineElement>, 'x1' | 'y1' | 'x2' | 'y2'>) {
  const inner = pointAt(ratio, GAUGE_TICK_IN_R - 6)
  const outer = pointAt(ratio, GAUGE_TICK_OUT_R + 6)
  return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} {...lineProps} />
}

// Velocímetro semicircular con escala numerada y degradado continuo. El rojo empieza en el más alto entre
// objetivo y TDEE: en déficit o mantenimiento, el TDEE (pasarte del objetivo pero seguir bajo tu TDEE no es un
// superávit real); en volumen, el objetivo ya está sobre el TDEE, así que el techo es directamente el objetivo.
// Es la única visualización de la tarjeta cuyo color cambia con el resultado; los macros de abajo no cambian.
function CalorieGauge({ consumed, target, tdee }: { consumed: number; target: number; tdee: number }) {
  const gradientId = useId()
  const margin = calculateCalorieMargin(consumed, target, tdee)
  const overThreshold = Math.max(target, tdee)
  const gaugeMax = overThreshold > 0 ? overThreshold * GAUGE_HEADROOM : 1
  const targetRatio = target / gaugeMax
  const tdeeRatio = tdee / gaugeMax
  const overRatioPct = (overThreshold / gaugeMax) * 100
  const targetRatioPct = targetRatio * 100
  const needle = pointAt(consumed / gaugeMax, GAUGE_NEEDLE_R)
  const zoneColor = MARGIN_VAR[margin.zone]
  const ticks = buildTicks(gaugeMax)
  // Objetivo y TDEE casi iguales (fase de mantenimiento): una sola marca alcanza, para no superponerlas
  const showTdeeTick = Math.abs(targetRatio - tdeeRatio) >= 0.02

  const left = pointAt(0, GAUGE_TRACK_R)
  const mid = pointAt(0.5, GAUGE_TRACK_R)
  const right = pointAt(1, GAUGE_TRACK_R)
  // Un solo path con 2 arcos de 90° (en vez de un semicírculo de 180° en un solo tramo, un caso límite ambiguo
  // en SVG), para que el redondeado de las puntas quede solo en los extremos reales y no en el empalme
  const arcPath = `M${left.x},${left.y} A${GAUGE_TRACK_R},${GAUGE_TRACK_R} 0 0 1 ${mid.x},${mid.y} A${GAUGE_TRACK_R},${GAUGE_TRACK_R} 0 0 1 ${right.x},${right.y}`

  return (
    <div className="mt-2">
      <svg viewBox="0 0 280 150" width={260} height={139} className="mx-auto block">
        <defs>
          <linearGradient id={gradientId} x1={left.x} y1={0} x2={right.x} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset="0%" style={{ stopColor: 'var(--emerald-400)' }} />
            <stop offset={`${targetRatioPct}%`} style={{ stopColor: 'var(--emerald-400)' }} />
            <stop offset={`${targetRatioPct}%`} style={{ stopColor: 'var(--amber-400)' }} />
            <stop offset={`${overRatioPct}%`} style={{ stopColor: 'var(--amber-400)' }} />
            <stop offset={`${overRatioPct}%`} style={{ stopColor: 'var(--red-400)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--red-400)' }} />
          </linearGradient>
        </defs>
        <path d={arcPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth={16} strokeLinecap="round" />
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke="var(--app-bg)" strokeWidth={2} opacity={0.85} />
            <text x={tick.lx} y={tick.ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--slate-500)">
              {tick.value}
            </text>
          </g>
        ))}
        <ReferenceTick ratio={targetRatio} stroke="var(--slate-200)" strokeWidth={3} />
        {showTdeeTick && <ReferenceTick ratio={tdeeRatio} stroke="var(--slate-200)" strokeWidth={1.5} strokeDasharray="2 2" />}
        <line x1={GAUGE_CX} y1={GAUGE_CY} x2={needle.x} y2={needle.y} stroke="var(--slate-200)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={8} fill="var(--slate-200)" />
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={4} fill={zoneColor} />
      </svg>
      <div className="-mt-2 text-center">
        <p className="text-[11px] text-slate-400">Margen de hoy</p>
        <p className={`${kcalText} text-3xl`} style={{ color: zoneColor }}>
          {margin.remaining >= 0 ? '+' : ''}
          {Math.round(margin.remaining)}
          <span className="text-sm font-medium text-slate-400"> kcal</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {margin.remaining >= 0
            ? 'Dentro de tu margen de hoy.'
            : `Pasaste tu objetivo por ${Math.round(-margin.remaining)} kcal.`}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 rounded-xl bg-slate-900 p-2.5">
          <p className="text-[10px] text-slate-400">🎯 Objetivo</p>
          <p className={`${kcalText} text-slate-200`}>{Math.round(target)} kcal</p>
          <p className="text-[10px] text-slate-500">TDEE {Math.round(tdee)} kcal</p>
        </div>
        <div className="flex-1 rounded-xl bg-slate-900 p-2.5">
          <p className="text-[10px] text-slate-400">🍽️ Consumido</p>
          <p className={`${kcalText} text-slate-200`}>{Math.round(consumed)} kcal</p>
          <p className="text-[10px] text-slate-500">de {Math.round(target)} kcal</p>
        </div>
      </div>
    </div>
  )
}

export function DayTotals({ totals, target, tdee, exerciseKcal = 0 }: DayTotalsProps) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <p className="text-xs uppercase text-slate-500">Total del día</p>
      {target ? (
        <CalorieGauge consumed={totals.kcal} target={target.kcal} tdee={tdee} />
      ) : (
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-slate-400">Calorías</span>
          <span className={`${kcalText} text-slate-200`}>{Math.round(totals.kcal)} kcal</span>
        </div>
      )}
      <BarRow
        label="Proteína"
        consumed={totals.proteinG}
        target={target ? target.macros.proteinG : null}
        unit="g"
        valueClass={proteinText}
        barClass="bg-red-400"
      />
      <BarRow
        label="Grasa"
        consumed={totals.fatG}
        target={target ? target.macros.fatG : null}
        unit="g"
        valueClass={fatText}
        barClass="bg-amber-400"
      />
      <BarRow
        label="Carbohidratos"
        consumed={totals.carbsG}
        target={target ? target.macros.carbsG : null}
        unit="g"
        valueClass={carbsText}
        barClass="bg-cyan-400"
      />
      {exerciseKcal > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Entrenamiento de este día: unas {exerciseKcal} kcal. Es una estimación y no se suma a tu objetivo.
        </p>
      )}
      {!target && <p className="mt-3 text-xs text-slate-500">Empieza una fase en la pestaña Plan para ver tu objetivo diario.</p>}
    </div>
  )
}
