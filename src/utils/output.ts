import { writeFile } from 'node:fs/promises'
import { PortProcess, formatProcess } from '../processManager'
import { OutputFormat } from './validation'

function renderCsv(processes: PortProcess[]): string {
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
  return [header, ...rows].join('\n')
}

export function renderProcesses(
  processes: PortProcess[],
  format: OutputFormat = 'text'
): string {
  if (format === 'json') {
    return JSON.stringify(processes, null, 2)
  }

  if (format === 'csv') {
    return renderCsv(processes)
  }

  if (processes.length === 0) {
    return 'No matching listening processes found.'
  }

  return processes.map((item) => formatProcess(item)).join('\n')
}

export async function outputProcesses(
  processes: PortProcess[],
  format: OutputFormat = 'text',
  destination?: string
): Promise<void> {
  const content = renderProcesses(processes, format)

  if (destination) {
    const finalContent = content.endsWith('\n') ? content : `${content}\n`
    await writeFile(destination, finalContent, { encoding: 'utf8' })
    console.log(`Saved output to ${destination}`)
    return
  }

  console.log(content)
}
