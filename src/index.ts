#!/usr/bin/env node
import { Command } from 'commander'
import { registerListCommand } from './commands/list'
import { registerInspectCommand } from './commands/inspect'
import { registerKillCommand } from './commands/kill'
import { registerWatchCommand } from './commands/watch'
import { registerInteractiveCommand } from './commands/interactive'

const program = new Command()

program
  .name('knows')
  .description('List, inspect, and kill local processes by port number.')
  .version('1.0.0')

registerListCommand(program)
registerInspectCommand(program)
registerKillCommand(program)
registerWatchCommand(program)
registerInteractiveCommand(program)

async function run(): Promise<void> {
  await program.parseAsync(process.argv)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
