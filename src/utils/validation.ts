export interface PortRange {
  min: number
  max: number
}

export type OutputFormat = 'text' | 'json' | 'csv'

export function parsePort(value: string): number {
  const port = Number.parseInt(value, 10)
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`)
  }
  return port
}

export function parseInterval(value: string): number {
  const interval = Number.parseInt(value, 10)
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error(`Invalid interval (ms): ${value}`)
  }
  return interval
}

export function parsePortRange(value: string): PortRange {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!match) {
    throw new Error(`Invalid port range: ${value}. Expected format start-end.`)
  }
  const min = parsePort(match[1])
  const max = parsePort(match[2])
  if (min > max) {
    throw new Error(
      `Invalid port range: start ${min} is greater than end ${max}.`
    )
  }
  return { min, max }
}

export function parseFormat(value: string): OutputFormat {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'text' || normalized === 'json' || normalized === 'csv') {
    return normalized
  }
  throw new Error(
    `Invalid format: ${value}. Expected one of text, json, or csv.`
  )
}
