#!/usr/bin/env node
import { Command } from 'commander'
import inquirer from 'inquirer'
import {
  filterByPort,
  filterByPortRange,
  formatProcess,
  killByPid,
  killByPort,
  listListeningProcesses,
  PortProcess,
} from './processManager'

interface PortRange {
  min: number
  max: number
}

type OutputFormat = 'text' | 'json' | 'csv'

const program = new Command()

program
  .name('knows')
  .description('List, inspect, and kill local processes by port number.')
  .version('1.0.0')

function toPort(value: string): number {
  const port = Number.parseInt(value, 10)
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`)
  }
  return port
}

function toInterval(value: string): number {
  const interval = Number.parseInt(value, 10)
  if (!Number.isFinite(interval) || interval <= 0) {
    throw new Error(`Invalid interval (ms): ${value}`)
  }
  return interval
}

function toPortRange(value: string): PortRange {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!match) {
    throw new Error(`Invalid port range: ${value}. Expected format start-end.`)
  }
  const min = toPort(match[1])
  const max = toPort(match[2])
  if (min > max) {
    throw new Error(
      `Invalid port range: start ${min} is greater than end ${max}.`
    )
  }
  return { min, max }
}

function toFormat(value: string): OutputFormat {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'text' || normalized === 'json' || normalized === 'csv') {
    return normalized
  }
  throw new Error(
    `Invalid format: ${value}. Expected one of text, json, or csv.`
  )
}

function printProcesses(
  processes: PortProcess[],
  format: OutputFormat = 'text'
): void {
  if (format === 'json') {
    console.log(JSON.stringify(processes, null, 2))
    return
  }

  if (format === 'csv') {
    const header = 'protocol,port,pid,address,command'
    const escapeCsv = (input: string | number | undefined): string => {
      const value = input === undefined ? '' : String(input)
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }
    const rows = processes.map((item) =>
      [
        escapeCsv(item.protocol),
        escapeCsv(item.port),
        escapeCsv(item.pid),
        escapeCsv(item.address),
        escapeCsv(item.command ?? ''),
      ].join(',')
    )
    console.log([header, ...rows].join('\n'))
    return
  }

  if (processes.length === 0) {
    console.log('No matching listening processes found.')
    return
  }
  processes.forEach((item) => {
    console.log(formatProcess(item))
  })
}

program
  .command('list')
  .description('List listening processes, optionally filtered by port.')
  .option('-p, --port <port>', 'Filter by port number', (value) =>
    toPort(value)
  )
  .option(
    '--port-range <start-end>',
    'Filter by an inclusive port range (example: 3000-3999)',
    (value) => toPortRange(value)
  )
  .option('-f, --format <format>', 'Output format (text, json, csv)', (value) =>
    toFormat(value)
  )
  .action(
    async (options: {
      port?: number
      portRange?: PortRange
      format?: OutputFormat
    }) => {
      try {
        const { port, portRange } = options
        if (port !== undefined && portRange !== undefined) {
          throw new Error('Use either --port or --port-range, not both.')
        }
        let processes: PortProcess[]
        if (port !== undefined) {
          processes = await filterByPort(port)
        } else if (portRange !== undefined) {
          processes = await filterByPortRange(portRange.min, portRange.max)
        } else {
          processes = await listListeningProcesses()
        }
        const format = options.format ?? 'text'
        printProcesses(processes, format)
      } catch (error) {
        console.error((error as Error).message)
        process.exitCode = 1
      }
    }
  )

program
  .command('inspect <port>')
  .description('Inspect all listening processes on a specific port.')
  .option('-f, --format <format>', 'Output format (text, json, csv)', (value) =>
    toFormat(value)
  )
  .action(
    async (
      portValue: string,
      options: {
        format?: OutputFormat
      }
    ) => {
      try {
        const port = toPort(portValue)
        const matches = await filterByPort(port)
        const format = options.format ?? 'text'
        printProcesses(matches, format)
      } catch (error) {
        console.error((error as Error).message)
        process.exitCode = 1
      }
    }
  )

program
  .command('kill <port>')
  .description('Kill every process listening on the specified port.')
  .option(
    '-f, --force',
    'Exit with non-zero status if any process fails to terminate'
  )
  .action(async (portValue: string, options: { force?: boolean }) => {
    try {
      const port = toPort(portValue)
      const { success, failed } = await killByPort(port)

      success.forEach((item) => {
        console.log(`Terminated ${formatProcess(item)}`)
      })
      failed.forEach(({ process: proc, error }) => {
        console.error(
          `Failed to terminate ${formatProcess(proc)} -> ${error.message}`
        )
      })

      if (failed.length > 0 && options.force) {
        process.exitCode = 1
      }
    } catch (error) {
      console.error((error as Error).message)
      process.exitCode = 1
    }
  })

program
  .command('watch')
  .description(
    'Continuously monitor listening processes until Ctrl+C or Ctrl+Q is pressed.'
  )
  .option('-p, --port <port>', 'Filter by port number', (value) =>
    toPort(value)
  )
  .option(
    '--port-range <start-end>',
    'Filter by an inclusive port range (example: 3000-3999)',
    (value) => toPortRange(value)
  )
  .option(
    '-i, --interval <ms>',
    'Refresh interval in milliseconds (default: 2000)',
    (value) => toInterval(value)
  )
  .action(
    async (options: {
      port?: number
      portRange?: PortRange
      interval?: number
    }) => {
      if (options.port !== undefined && options.portRange !== undefined) {
        console.error('Use either --port or --port-range, not both.')
        process.exitCode = 1
        return
      }
      const refreshInterval = options.interval ?? 2000
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('Watch mode requires an interactive TTY.')
        process.exitCode = 1
        return
      }

      let stopped = false
      const seenKeys = new Set<string>()
      const stdin = process.stdin

      function makeKey(proc: PortProcess): string {
        return `${proc.protocol}:${proc.port}:${proc.pid}`
      }

      function stopWatching(): void {
        if (stopped) {
          return
        }
        stopped = true
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (stdin.isTTY) {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
        }
        console.log('\nWatch stopped.')
      }

      async function fetchProcesses(): Promise<PortProcess[]> {
        if (options.port !== undefined) {
          return await filterByPort(options.port)
        }
        if (options.portRange !== undefined) {
          const { min, max } = options.portRange
          return await filterByPortRange(min, max)
        }
        return await listListeningProcesses()
      }

      async function renderOnce(): Promise<void> {
        try {
          const processes = await fetchProcesses()
          const currentKeys = new Set<string>()

          process.stdout.write('\x1Bc')
          const timestamp = new Date().toLocaleTimeString()
          console.log(
            `Watching listening processes @ ${timestamp} (refresh ${refreshInterval} ms)`
          )
          console.log('Press Ctrl+C or Ctrl+Q to exit.\n')

          if (processes.length === 0) {
            console.log('No matching listening processes found.')
          } else {
            processes.forEach((proc) => {
              const key = makeKey(proc)
              currentKeys.add(key)
              const isNew = !seenKeys.has(key)
              const prefix = isNew ? '+' : ' '
              console.log(`${prefix} ${formatProcess(proc)}`)
            })
          }

          seenKeys.clear()
          currentKeys.forEach((key) => {
            seenKeys.add(key)
          })
        } catch (error) {
          console.error((error as Error).message)
        }
      }

      let pending = false
      let timer: NodeJS.Timeout | null = null

      const onData = (buffer: Buffer): void => {
        const byte = buffer[0]
        if (byte === 3 || byte === 17) {
          stopWatching()
        }
      }

      async function schedule(): Promise<void> {
        if (stopped) {
          return
        }
        if (pending) {
          return
        }
        pending = true
        await renderOnce()
        pending = false
        if (!stopped) {
          timer = setTimeout(schedule, refreshInterval)
        }
      }

      if (stdin.isTTY) {
        stdin.setRawMode(true)
        stdin.resume()
        stdin.on('data', onData)
      }

      await schedule()
    }
  )

program
  .command('interactive')
  .description('Interactive mode to inspect or kill processes with arrow keys.')
  .action(async () => {
    try {
      const processes = await listListeningProcesses()
      if (processes.length === 0) {
        console.log('No listening processes found.')
        return
      }

      const portMap = new Map<number, PortProcess[]>()
      processes.forEach((processInfo) => {
        const list = portMap.get(processInfo.port) ?? []
        list.push(processInfo)
        portMap.set(processInfo.port, list)
      })

      const { selectedPort } = await inquirer.prompt<{ selectedPort: number }>([
        {
          type: 'list',
          name: 'selectedPort',
          message: 'Select a port',
          choices: Array.from(portMap.keys())
            .sort((a, b) => a - b)
            .map((port) => ({
              name: `Port ${port} (${portMap.get(port)?.length ?? 0} listener(s))`,
              value: port,
            })),
          pageSize: 10,
        },
      ])

      const matches = portMap.get(selectedPort) ?? []
      const { selectedPid } = await inquirer.prompt<{ selectedPid: number }>([
        {
          type: 'list',
          name: 'selectedPid',
          message: `Select a process on port ${selectedPort}`,
          choices: matches.map((match) => ({
            name: formatProcess(match),
            value: match.pid,
          })),
          pageSize: 10,
        },
      ])

      const target = matches.find((item) => item.pid === selectedPid)
      if (!target) {
        console.error('Unable to resolve the selected process.')
        return
      }

      const { action } = await inquirer.prompt<{ action: 'inspect' | 'kill' }>([
        {
          type: 'list',
          name: 'action',
          message: 'Choose an action',
          choices: [
            { name: 'Inspect', value: 'inspect' },
            { name: 'Kill', value: 'kill' },
          ],
        },
      ])

      if (action === 'inspect') {
        console.log(formatProcess(target))
      } else {
        try {
          await killByPid(target.pid)
          console.log(`Terminated ${formatProcess(target)}`)
        } catch (error) {
          console.error(
            `Failed to terminate ${formatProcess(target)} -> ${(error as Error).message}`
          )
          process.exitCode = 1
        }
      }
    } catch (error) {
      console.error((error as Error).message)
      process.exitCode = 1
    }
  })

async function run(): Promise<void> {
  await program.parseAsync(process.argv)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
