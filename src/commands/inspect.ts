import { Command } from 'commander'
import { filterByPort } from '../processManager'
import { OutputFormat, parseFormat, parsePort } from '../utils/validation'
import { outputProcesses } from '../utils/output'

interface InspectOptions {
  format?: OutputFormat
  output?: string
}

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect <port>')
    .description('Inspect all listening processes on a specific port.')
    .option(
      '-f, --format <format>',
      'Output format (text, json, csv)',
      (value) => parseFormat(value)
    )
    .option('-o, --output <file>', 'Write output to the specified file')
    .action(async (portValue: string, options: InspectOptions) => {
      try {
        const port = parsePort(portValue)
        const matches = await filterByPort(port)
        const format = options.format ?? 'text'
        await outputProcesses(matches, format, options.output)
      } catch (error) {
        console.error((error as Error).message)
        process.exitCode = 1
      }
    })
}
