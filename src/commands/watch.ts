import { Command } from 'commander'
import {
  filterByPort,
  filterByPortRange,
  formatProcess,
  listListeningProcesses,
  PortProcess,
} from '../processManager'
import {
  parseInterval,
  parsePort,
  parsePortRange,
  PortRange,
} from '../utils/validation'

interface WatchOptions {
  port?: number
  portRange?: PortRange
  interval?: number
}

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description(
      'Continuously monitor listening processes until Ctrl+C or Ctrl+Q is pressed.'
    )
    .option('-p, --port <port>', 'Filter by port number', (value) =>
      parsePort(value)
    )
    .option(
      '--port-range <start-end>',
      'Filter by an inclusive port range (example: 3000-3999)',
      (value) => parsePortRange(value)
    )
    .option(
      '-i, --interval <ms>',
      'Refresh interval in milliseconds (default: 2000)',
      (value) => parseInterval(value)
    )
    .action(async (options: WatchOptions) => {
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
    })
}
