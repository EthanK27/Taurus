import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { Button } from '@/components/ui/button'

const formatCurrency = (value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const formatPercent = (value) => `${value.toFixed(2)}%`

const RANGE_DAYS = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365
}

const RANGE_LABELS = {
  '1D': '1 Day',
  '1W': '1 Week',
  '1M': '1 Month',
  '3M': '3 Months',
  '1Y': '1 Year',
  ALL: 'All Time'
}

const SERIES_LABELS = {
  user: 'User',
  benchmark: 'S&P 500'
}

const X_TICK_COUNTS = {
  '1D': 6,
  '1W': 7,
  '1M': 5,
  '3M': 6,
  '1Y': 12,
  ALL: 8
}

const formatDateInput = (timestamp) => timestamp?.slice(0, 10) ?? ''

const formatReadableDate = (value) => {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00.000Z`))
}

const addUTCDays = (value, days) => {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}

const toTimestampBoundary = (value, endOfDay = false) => {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0))

  return date.toISOString().slice(0, 16).replace('T', ' ')
}

const parseTimestamp = (value) => new Date(`${value.replace(' ', 'T')}:00.000Z`)

const formatTimestampForRange = (value, range) => {
  const date = parseTimestamp(value)

  if (range === '1D') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    }).format(date)
  }

  if (range === '1W') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date)
  }

  if (range === '1M' || range === '3M') {
    return `Wk ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date)}`
  }

  if (range === '1Y') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    }).format(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

const formatTimestampWithTime = (value) => {
  const date = parseTimestamp(value)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(date)
}

const buildXTicks = (series, range) => {
  if (!series.length) return []

  const targetTickCount = X_TICK_COUNTS[range] ?? 6
  const stride = Math.max(1, Math.floor((series.length - 1) / (targetTickCount - 1)))
  const ticks = []

  for (let index = 0; index < series.length; index += stride) {
    ticks.push(series[index].timestamp)
  }

  const lastTimestamp = series.at(-1)?.timestamp
  if (lastTimestamp && ticks.at(-1) !== lastTimestamp) {
    ticks.push(lastTimestamp)
  }

  return ticks
}

const buildYTicks = (series, showBenchmark) => {
  if (!series.length) return [0, 1, 2, 3, 4, 5]

  const values = []
  for (const item of series) {
    if (typeof item.userPnl === 'number') values.push(item.userPnl)
    if (showBenchmark && typeof item.benchmarkPnl === 'number') values.push(item.benchmarkPnl)
  }

  if (!values.length) return [0, 1, 2, 3, 4, 5]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(max - min, 1)
  const padding = spread * 0.08
  const low = min - padding
  const high = max + padding
  const blocks = 5
  const step = (high - low) / blocks

  return Array.from({ length: blocks + 1 }, (_, index) => Number((low + step * index).toFixed(2)))
}

const formatAxisCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

const buildVisibleWindow = ({ data, range, startDate, availableEndDate }) => {
  if (!data.length || !startDate) return []

  const dayCount = range === 'ALL' ? data.length : (RANGE_DAYS[range] ?? 30)
  const endDate = range === 'ALL' ? availableEndDate : addUTCDays(startDate, dayCount - 1)
  const clippedEndDate = endDate > availableEndDate ? availableEndDate : endDate

  const startBoundary = toTimestampBoundary(startDate)
  const endBoundary = toTimestampBoundary(clippedEndDate, true)

  return data.filter((entry) => entry.timestamp >= startBoundary && entry.timestamp <= endBoundary)
}

const downsample = (data, range) => {
  if (!data || data.length === 0) return []

  let bucketSize = 1
  switch (range) {
    case '1D': bucketSize = 1; break
    case '1W': bucketSize = 3; break
    case '1M': bucketSize = 24; break
    case '3M': bucketSize = 72; break
    case '1Y': bucketSize = 168; break
    case 'ALL': bucketSize = Math.ceil(data.length / 500); break
    default: break
  }

  const result = []
  for (let index = 0; index < data.length; index += bucketSize) {
    const slice = data.slice(index, index + bucketSize)
    const average = slice.reduce((total, entry) => total + entry.pnl, 0) / slice.length
    result.push({
      timestamp: slice[0].timestamp,
      pnl: average
    })
  }

  return result
}

const mergeSeries = (userSeries, benchmarkSeries) => {
  const benchmarkByTimestamp = new Map(benchmarkSeries.map((entry) => [entry.timestamp, entry.pnl]))

  return userSeries.map((entry) => ({
    timestamp: entry.timestamp,
    userPnl: entry.pnl,
    benchmarkPnl: benchmarkByTimestamp.get(entry.timestamp) ?? null
  }))
}

export default function PnLChart({ data = [], benchmarkData = [] }) {
  const [range, setRange] = useState('1M')
  const [mode, setMode] = useState('area')
  const [startDate, setStartDate] = useState(() => formatDateInput(data[0]?.timestamp))
  const [showBenchmark, setShowBenchmark] = useState(true)

  const availableStartDate = formatDateInput(data[0]?.timestamp)
  const availableEndDate = formatDateInput(data.at(-1)?.timestamp)
  const selectedStartDate = startDate || availableStartDate

  const visibleData = useMemo(
    () => buildVisibleWindow({ data, range, startDate: selectedStartDate, availableEndDate }),
    [data, range, selectedStartDate, availableEndDate]
  )

  const visibleBenchmarkData = useMemo(
    () => buildVisibleWindow({ data: benchmarkData, range, startDate: selectedStartDate, availableEndDate }),
    [benchmarkData, range, selectedStartDate, availableEndDate]
  )

  const processed = useMemo(() => downsample(visibleData, range), [visibleData, range])
  const processedBenchmark = useMemo(() => downsample(visibleBenchmarkData, range), [visibleBenchmarkData, range])
  const chartData = useMemo(() => mergeSeries(processed, processedBenchmark), [processed, processedBenchmark])
  const xTicks = useMemo(() => buildXTicks(chartData, range), [chartData, range])
  const yTicks = useMemo(() => buildYTicks(chartData, showBenchmark), [chartData, showBenchmark])

  const start = processed[0]?.pnl || 0
  const end = processed[processed.length - 1]?.pnl || 0
  const pnl = end - start
  const pct = start !== 0 ? (pnl / Math.abs(start)) * 100 : 0
  const positive = pnl >= 0
  const selectedRangeLabel = RANGE_LABELS[range] ?? range
  const selectedEndDate = useMemo(() => {
    if (!selectedStartDate) return ''

    if (range === 'ALL') {
      return availableEndDate
    }

    const dayCount = RANGE_DAYS[range] ?? 30
    const expectedEndDate = addUTCDays(selectedStartDate, dayCount - 1)
    return expectedEndDate > availableEndDate ? availableEndDate : expectedEndDate
  }, [availableEndDate, range, selectedStartDate])

  const benchmarkStart = processedBenchmark[0]?.pnl || 0
  const benchmarkEnd = processedBenchmark[processedBenchmark.length - 1]?.pnl || 0
  const benchmarkPnl = benchmarkEnd - benchmarkStart

  return (
    <motion.div
      className="pnl-chart"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="pnl-chart__calendar-panel">
        <div>
          <div className="pnl-chart__eyebrow">Calendar</div>
          <label className="pnl-chart__calendar-field">
            <span>Start date</span>
            <input
              type="date"
              value={selectedStartDate}
              min={availableStartDate}
              max={availableEndDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
        </div>

        <div className="pnl-chart__calendar-summary">
          <div className="pnl-chart__calendar-summary-label">Selected period</div>
          <div className="pnl-chart__calendar-summary-value">
            {selectedRangeLabel}: {formatReadableDate(selectedStartDate)} - {formatReadableDate(selectedEndDate)}
          </div>
        </div>
      </div>

      <div className="pnl-chart__header">
        <div className="pnl-chart__header-row">
          <div className={`pnl-chart__pnl ${positive ? 'pnl-chart__pnl--positive' : 'pnl-chart__pnl--negative'}`}>
            {formatCurrency(pnl)}
          </div>
          <div className="pnl-chart__legend-item">
            <span className="pnl-chart__legend-swatch pnl-chart__legend-swatch--user" />
            <span>{SERIES_LABELS.user}</span>
          </div>
          {showBenchmark ? (
            <div className="pnl-chart__legend-item">
              <span className="pnl-chart__legend-swatch pnl-chart__legend-swatch--benchmark" />
              <span>{SERIES_LABELS.benchmark}</span>
            </div>
          ) : null}
        </div>
        <div className="pnl-chart__subtext">
          {formatPercent(pct)} over selected range{showBenchmark ? ` • ${formatCurrency(benchmarkPnl)} for ${SERIES_LABELS.benchmark}` : ''}
        </div>
      </div>

      <div className="pnl-chart__controls">
        {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((item) => (
          <Button
            key={item}
            variant={range === item ? 'default' : 'outline'}
            onClick={() => setRange(item)}
          >
            {item}
          </Button>
        ))}

        <div className="pnl-chart__mode-switcher">
          <Button
            variant={showBenchmark ? 'default' : 'outline'}
            onClick={() => setShowBenchmark((current) => !current)}
          >
            S&P 500
          </Button>
          <Button variant={mode === 'line' ? 'default' : 'outline'} onClick={() => setMode('line')}>
            Line
          </Button>
          <Button variant={mode === 'area' ? 'default' : 'outline'} onClick={() => setMode('area')}>
            Area
          </Button>
        </div>
      </div>

      <div className="pnl-chart__plot">
        <ResponsiveContainer>
          {mode === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="timestamp"
                ticks={xTicks}
                tickFormatter={(value) => formatTimestampForRange(value, range)}
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                minTickGap={20}
              />
              <YAxis
                ticks={yTicks}
                domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                tickFormatter={formatAxisCurrency}
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                width={70}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null

                  const userValue = payload.find((item) => item.dataKey === 'userPnl')?.value
                  const benchmarkValue = payload.find((item) => item.dataKey === 'benchmarkPnl')?.value
                  const userChange = start !== 0 && typeof userValue === 'number' ? ((userValue - start) / Math.abs(start)) * 100 : 0
                  const benchmarkChange = benchmarkStart !== 0 && typeof benchmarkValue === 'number'
                    ? ((benchmarkValue - benchmarkStart) / Math.abs(benchmarkStart)) * 100
                    : 0

                  return (
                    <div className="pnl-chart__tooltip">
                      <div className="pnl-chart__tooltip-time">{formatTimestampWithTime(label)}</div>
                      <div>{SERIES_LABELS.user}: {formatCurrency(userValue ?? 0)} ({formatPercent(userChange)})</div>
                      {showBenchmark && typeof benchmarkValue === 'number' ? (
                        <div>{SERIES_LABELS.benchmark}: {formatCurrency(benchmarkValue)} ({formatPercent(benchmarkChange)})</div>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="userPnl" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive />
              {showBenchmark ? (
                <Line type="monotone" dataKey="benchmarkPnl" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive connectNulls={false} />
              ) : null}
            </LineChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="userAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.45} />
                  <stop offset="100%" stopOpacity={0} />
                </linearGradient>
                {showBenchmark ? (
                  <linearGradient id="benchmarkAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="100%" stopOpacity={0} />
                  </linearGradient>
                ) : null}
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="timestamp"
                ticks={xTicks}
                tickFormatter={(value) => formatTimestampForRange(value, range)}
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                minTickGap={20}
              />
              <YAxis
                ticks={yTicks}
                domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                tickFormatter={formatAxisCurrency}
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                width={70}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null

                  const userValue = payload.find((item) => item.dataKey === 'userPnl')?.value
                  const benchmarkValue = payload.find((item) => item.dataKey === 'benchmarkPnl')?.value
                  const userChange = start !== 0 && typeof userValue === 'number' ? ((userValue - start) / Math.abs(start)) * 100 : 0
                  const benchmarkChange = benchmarkStart !== 0 && typeof benchmarkValue === 'number'
                    ? ((benchmarkValue - benchmarkStart) / Math.abs(benchmarkStart)) * 100
                    : 0

                  return (
                    <div className="pnl-chart__tooltip">
                      <div className="pnl-chart__tooltip-time">{formatTimestampWithTime(label)}</div>
                      <div>{SERIES_LABELS.user}: {formatCurrency(userValue ?? 0)} ({formatPercent(userChange)})</div>
                      {showBenchmark && typeof benchmarkValue === 'number' ? (
                        <div>{SERIES_LABELS.benchmark}: {formatCurrency(benchmarkValue)} ({formatPercent(benchmarkChange)})</div>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Area type="monotone" dataKey="userPnl" stroke="#2563eb" strokeWidth={2} fill="url(#userAreaGradient)" dot={false} isAnimationActive />
              {showBenchmark ? (
                <Area
                  type="monotone"
                  dataKey="benchmarkPnl"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#benchmarkAreaGradient)"
                  dot={false}
                  isAnimationActive
                />
              ) : null}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}