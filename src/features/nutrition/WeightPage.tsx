import { useEffect, useId, useState } from 'react'
import { firebaseWeighInRepository } from '@/data/firestore/weighInRepository'
import { NumberField } from '@/app/NumberField'
import { addDaysToLocalDate, formatShortLocalDate, toLocalDateString } from '@/domain/localDate'
import {
  calculateTrendRateKgPerWeek,
  calculateWeightTrend,
  isPlausibleWeightKg,
  isSuspiciousJump,
  type WeighIn,
} from '@/domain/weightTrend'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chip, primaryButton } from '@/app/buttonStyles'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'

const RANGES = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 180, label: '6 meses' },
] as const

const RECENT_LIST_SIZE = 10


export function WeightPage() {
  const fieldId = useId()
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [date, setDate] = useState(() => toLocalDateString(new Date()))
  const [weightKg, setWeightKg] = useState(0)
  const [rangeDays, setRangeDays] = useState<number>(90)
  const [openSwipeDate, setOpenSwipeDate] = useState<string | null>(null) // solo un pesaje deslizado a la vez

  useEffect(() => {
    const unsubscribe = firebaseWeighInRepository.subscribeWeighIns(setWeighIns)
    return unsubscribe
  }, [])

  const today = toLocalDateString(new Date())
  const trend = calculateWeightTrend(weighIns) // con todo el historial cargado: la tendencia necesita "calentar"
  const latest = trend[trend.length - 1]
  const weeklyRateKg = calculateTrendRateKgPerWeek(trend)

  const chartStart = addDaysToLocalDate(today, -(rangeDays - 1))
  const chartData = trend
    .filter((point) => point.date >= chartStart)
    .map((point) => ({
      label: formatShortLocalDate(point.date),
      weightKg: point.weightKg,
      trendKg: Math.round(point.trendKg * 100) / 100,
    }))

  // Validación del formulario
  const existing = weighIns.find((weighIn) => weighIn.date === date)
  const isDateValid = date !== '' && date <= today
  const isWeightValid = isPlausibleWeightKg(weightKg)
  const isValid = isDateValid && isWeightValid

  // Aviso (no bloquea) si se aleja mucho de la tendencia que había hasta el día anterior
  const trendBefore = [...trend].reverse().find((point) => point.date < date)
  const showJumpNotice = isWeightValid && trendBefore !== undefined && isSuspiciousJump(trendBefore.trendKg, weightKg)

  function handleSave() {
    if (!isValid) return
    firebaseWeighInRepository.saveWeighIn({ date, weightKg })
  }

  function loadIntoForm(weighIn: WeighIn) {
    setDate(weighIn.date)
    setWeightKg(weighIn.weightKg)
  }

  const recent = [...weighIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_LIST_SIZE)

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Peso</h1>

      {latest ? (
        <div className="mt-3 rounded-xl bg-slate-800 p-3">
          <p className="text-xs text-slate-500">Peso de tendencia</p>
          <p className="text-2xl font-bold">{latest.trendKg.toFixed(1)} kg</p>
          <p className="text-xs text-slate-400">
            {weeklyRateKg === null
              ? 'Registra al menos dos pesajes para ver tu ritmo.'
              : `${weeklyRateKg > 0 ? '+' : weeklyRateKg < 0 ? '−' : ''}${Math.abs(weeklyRateKg).toFixed(2)} kg por semana (últimas 2 semanas)`}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            La tendencia suaviza el sube y baja diario del agua y la comida: es el número que importa, no el de un día.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          Aún no tienes pesajes. Pésate cada mañana, en ayunas y después de ir al baño, y anótalo aquí.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-900 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Fecha</label>
            <input id={`${fieldId}-1`}
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Peso (kg)</label>
            <NumberField id={`${fieldId}-2`}
              value={weightKg}
              onChange={setWeightKg}
              ariaLabel="Peso en kilogramos"
              className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {existing && <p className="text-xs text-slate-400">Ya hay un pesaje ese día ({existing.weightKg} kg): se reemplazará.</p>}
        {weightKg !== 0 && !isWeightValid && (
          <p className="text-xs text-amber-400">Ese peso no parece correcto; debe estar entre 20 y 400 kg.</p>
        )}
        {showJumpNotice && trendBefore && (
          <p className="text-xs text-amber-400">
            Es bastante distinto de tu tendencia ({trendBefore.trendKg.toFixed(1)} kg). Si está bien, guárdalo igual.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className={primaryButton}
        >
          {existing ? 'Actualizar pesaje' : 'Guardar pesaje'}
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Peso real y tendencia</h2>
            <div className="flex gap-2">
              {RANGES.map((range) => (
                <button key={range.days} type="button" onClick={() => setRangeDays(range.days)} className={chip(rangeDays === range.days)}>
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--slate-700)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--slate-500)', fontSize: 11 }} stroke="var(--slate-700)" minTickGap={24} />
                <YAxis
                  domain={([min, max]) => [Math.floor(min) - 1, Math.ceil(max) + 1]}
                  tick={{ fill: 'var(--slate-500)', fontSize: 11 }}
                  stroke="var(--slate-700)"
                />
                <Tooltip
                  contentStyle={{ background: 'var(--slate-900)', border: '1px solid var(--slate-700)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--slate-400)' }}
                  formatter={(value, name) => [`${Number(value).toFixed(1)} kg`, name]}
                />
                {/* Peso de cada día: solo puntos, sin línea que una los altibajos */}
                <Line
                  type="linear"
                  dataKey="weightKg"
                  name="Peso"
                  stroke="none"
                  dot={{ r: 3, fill: 'var(--slate-500)', stroke: 'none' }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="trendKg"
                  name="Tendencia"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-slate-500">Los puntos son tu peso de cada día; la línea azul, la tendencia.</p>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold">Últimos pesajes</h2>
          {recent.map((weighIn) => (
            <SwipeToDeleteRow
              key={weighIn.date}
              isOpen={openSwipeDate === weighIn.date}
              onOpenChange={(open) => setOpenSwipeDate(open ? weighIn.date : null)}
              onDelete={() => {
                if (window.confirm(`¿Eliminar el pesaje del ${formatShortLocalDate(weighIn.date)}?`)) {
                  firebaseWeighInRepository.deleteWeighIn(weighIn.date)
                }
                setOpenSwipeDate(null)
              }}
              deleteLabel={`Eliminar pesaje del ${formatShortLocalDate(weighIn.date)}`}
            >
              <button type="button" onClick={() => loadIntoForm(weighIn)} className="flex w-full items-center justify-between py-2 text-left">
                <span className="text-sm text-slate-400">{formatShortLocalDate(weighIn.date)}</span>
                <span className="text-sm font-medium">{weighIn.weightKg} kg</span>
              </button>
            </SwipeToDeleteRow>
          ))}
          <p className="mt-2 text-xs text-slate-500">Toca un pesaje para corregirlo.</p>
        </div>
      )}
    </section>
  )
}
