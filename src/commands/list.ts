import { Command } from 'commander'
import {
  filterByPort,
  filterByPortRange,
  listListeningProcesses,
  PortProcess,
} from '../processManager'
import {
  OutputFormat,
  PortRange,
  parseFormat,
  parsePort,
  parsePortRange,
} from '../utils/validation'
import { outputProcesses } from '../utils/output'

interface ListOptions {
  port?: number
  portRange?: PortRange
  format?: OutputFormat
  output?: string
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List listening processes, optionally filtered by port.')
    .option('-p, --port <port>', 'Filter by port number', (value) =>
      parsePort(value)
    )
    .option(
      '--port-range <start-end>',
      'Filter by an inclusive port range (example: 3000-3999)',
      (value) => parsePortRange(value)
    )
    .option(
      '-f, --format <format>',
      'Output format (text, json, csv)',
      (value) => parseFormat(value)
    )
    .option('-o, --output <file>', 'Write output to the specified file')
    .action(async (options: ListOptions) => {
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
        await outputProcesses(processes, format, options.output)
      } catch (error) {
        console.error((error as Error).message)
        process.exitCode = 1
      }
    })
}
