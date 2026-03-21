import PnLChart from './components/PnLChart'

const createSeededRandom = (seed) => {
  let state = seed

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const createHourlyPnLData = ({
  hours = 24 * 540,
  startValue = 10000,
  seed = 42,
  driftPerHour = 4,
  amplitude = 1,
  noiseScale = 80
} = {}) => {
  const random = createSeededRandom(seed)
  const series = []
  const startTime = new Date('2024-09-01T00:00:00.000Z').getTime()
  let pnl = startValue

  for (let hour = 0; hour < hours; hour += 1) {
    const time = new Date(startTime + hour * 60 * 60 * 1000)
    const trend = Math.sin(hour / 48) * 22 + Math.sin(hour / 168) * 55
    const noise = (random() - 0.5) * noiseScale
    const drift = driftPerHour + Math.sin(hour / 720) * 2

    pnl = Math.max(1500, pnl + drift + trend * 0.08 * amplitude + noise)

    series.push({
      timestamp: time.toISOString().slice(0, 16).replace('T', ' '),
      pnl
    })
  }

  return series
}

const sampleData = createHourlyPnLData({
  startValue: 10000,
  seed: 42,
  driftPerHour: 4.25,
  amplitude: 1,
  noiseScale: 72
})

const benchmarkData = createHourlyPnLData({
  startValue: 4800,
  seed: 7,
  driftPerHour: 2.15,
  amplitude: 0.7,
  noiseScale: 54
})

export default function App() {
  return (
    <main className="app-shell">
      <PnLChart data={sampleData} benchmarkData={benchmarkData} />
    </main>
  )
}