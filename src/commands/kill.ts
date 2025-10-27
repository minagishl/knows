import inquirer from 'inquirer'
import { Command } from 'commander'
import { filterByPort, formatProcess, killByPort } from '../processManager'
import { parsePort } from '../utils/validation'

interface KillOptions {
  force?: boolean
}

export function registerKillCommand(program: Command): void {
  program
    .command('kill <port>')
    .description(
      'Kill every process listening on the specified port (with confirmation).'
    )
    .option(
      '-f, --force',
      'Skip confirmation and terminate matching processes immediately'
    )
    .action(async (portValue: string, options: KillOptions) => {
      try {
        const port = parsePort(portValue)
        const matches = await filterByPort(port)

        if (matches.length === 0) {
          console.log(`No listening processes found on port ${port}.`)
          return
        }

        if (!options.force) {
          console.log('The following processes will be terminated:')
          matches.forEach((item) => {
            console.log(` - ${formatProcess(item)}`)
          })

          const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `Proceed with terminating ${matches.length} process(es) on port ${port}?`,
              default: false,
            },
          ])

          if (!confirmed) {
            console.log('Termination aborted.')
            return
          }
        }

        const { success, failed } = await killByPort(port)

        success.forEach((item) => {
          console.log(`Terminated ${formatProcess(item)}`)
        })
        failed.forEach(({ process: proc, error }) => {
          console.error(
            `Failed to terminate ${formatProcess(proc)} -> ${error.message}`
          )
        })

        if (failed.length > 0) {
          process.exitCode = 1
        }
      } catch (error) {
        console.error((error as Error).message)
        process.exitCode = 1
      }
    })
}
