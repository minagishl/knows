import inquirer from 'inquirer'
import { Command } from 'commander'
import {
  formatProcess,
  killByPid,
  listListeningProcesses,
  PortProcess,
} from '../processManager'

export function registerInteractiveCommand(program: Command): void {
  program
    .command('interactive')
    .description(
      'Interactive mode to inspect or kill processes with arrow keys.'
    )
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

        const { selectedPort } = await inquirer.prompt<{
          selectedPort: number
        }>([
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

        const { action } = await inquirer.prompt<{
          action: 'inspect' | 'kill'
        }>([
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
}
