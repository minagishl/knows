#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import {
	filterByPort,
	formatProcess,
	killByPid,
	killByPort,
	listListeningProcesses,
	PortProcess,
} from './processManager';

const program = new Command();

program
	.name('knows')
	.description('List, inspect, and kill local processes by port number.')
	.version('0.1.0');

function toPort(value: string): number {
	const port = Number.parseInt(value, 10);
	if (!Number.isFinite(port) || port <= 0 || port > 65535) {
		throw new Error(`Invalid port: ${value}`);
	}
	return port;
}

function printProcesses(processes: PortProcess[]): void {
	if (processes.length === 0) {
		console.log('No matching listening processes found.');
		return;
	}
	processes.forEach((item) => {
		console.log(formatProcess(item));
	});
}

program
	.command('list')
	.description('List listening processes, optionally filtered by port.')
	.option('-p, --port <port>', 'Filter by port number', (value) => toPort(value))
	.action(async (options: { port?: number }) => {
		try {
			const processes = options.port
				? await filterByPort(options.port)
				: await listListeningProcesses();
			printProcesses(processes);
		} catch (error) {
			console.error((error as Error).message);
			process.exitCode = 1;
		}
	});

program
	.command('inspect <port>')
	.description('Inspect all listening processes on a specific port.')
	.action(async (portValue: string) => {
		try {
			const port = toPort(portValue);
			const matches = await filterByPort(port);
			printProcesses(matches);
		} catch (error) {
			console.error((error as Error).message);
			process.exitCode = 1;
		}
	});

program
	.command('kill <port>')
	.description('Kill every process listening on the specified port.')
	.option('-f, --force', 'Exit with non-zero status if any process fails to terminate')
	.action(async (portValue: string, options: { force?: boolean }) => {
		try {
			const port = toPort(portValue);
			const { success, failed } = await killByPort(port);

			success.forEach((item) => {
				console.log(`Terminated ${formatProcess(item)}`);
			});
			failed.forEach(({ process: proc, error }) => {
				console.error(`Failed to terminate ${formatProcess(proc)} -> ${error.message}`);
			});

			if (failed.length > 0 && options.force) {
				process.exitCode = 1;
			}
		} catch (error) {
			console.error((error as Error).message);
			process.exitCode = 1;
		}
	});

program
	.command('interactive')
	.description('Interactive mode to inspect or kill processes with arrow keys.')
	.action(async () => {
		try {
			const processes = await listListeningProcesses();
			if (processes.length === 0) {
				console.log('No listening processes found.');
				return;
			}

			const portMap = new Map<number, PortProcess[]>();
			processes.forEach((processInfo) => {
				const list = portMap.get(processInfo.port) ?? [];
				list.push(processInfo);
				portMap.set(processInfo.port, list);
			});

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
			]);

			const matches = portMap.get(selectedPort) ?? [];
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
			]);

			const target = matches.find((item) => item.pid === selectedPid);
			if (!target) {
				console.error('Unable to resolve the selected process.');
				return;
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
			]);

			if (action === 'inspect') {
				console.log(formatProcess(target));
			} else {
				try {
					await killByPid(target.pid);
					console.log(`Terminated ${formatProcess(target)}`);
				} catch (error) {
					console.error(
						`Failed to terminate ${formatProcess(target)} -> ${(error as Error).message}`
					);
					process.exitCode = 1;
				}
			}
		} catch (error) {
			console.error((error as Error).message);
			process.exitCode = 1;
		}
	});

async function run(): Promise<void> {
	await program.parseAsync(process.argv);
}

run().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
