import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import findProcess from 'find-process'

const execAsync = promisify(exec)

export interface PortProcess {
  pid: number
  port: number
  protocol: string
  address: string
  command?: string
}

async function runCommand(command: string): Promise<string> {
  const { stdout } = await execAsync(command, {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  })
  return stdout
}

function parseAddress(token: string): { address: string; port: number } | null {
  const match = token.match(/^(.*):(\d+)$/)
  if (!match) {
    return null
  }
  let address = match[1]
  if (address.startsWith('[') && address.endsWith(']')) {
    address = address.slice(1, -1)
  }
  return {
    address,
    port: Number.parseInt(match[2], 10),
  }
}

async function getUnixProcesses(): Promise<PortProcess[]> {
  let output: string
  try {
    output = await runCommand('lsof -iTCP -sTCP:LISTEN -P -n')
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      output = String((error as { stdout?: string }).stdout ?? '')
    } else {
      throw error
    }
  }

  const lines = output.split(/\r?\n/).slice(1)
  const results: PortProcess[] = []

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }
    const protocolMatch = line.match(/\b(TCP|UDP)\b/i)
    const protocol = protocolMatch ? protocolMatch[0].toUpperCase() : 'TCP'
    const parts = line.trim().split(/\s+/)
    const command = parts[0]
    const pid = Number.parseInt(parts[1], 10)

    if (!Number.isFinite(pid)) {
      continue
    }

    const addressMatch = line.match(/([\w.*:[\]]+):(\d+)/)
    if (!addressMatch) {
      continue
    }
    let address = addressMatch[1]
    if (address.startsWith('[') && address.endsWith(']')) {
      address = address.slice(1, -1)
    }
    const port = Number.parseInt(addressMatch[2], 10)

    results.push({
      pid,
      port,
      protocol,
      address,
      command,
    })
  }

  return results
}

async function getWindowsProcesses(): Promise<PortProcess[]> {
  const output = await runCommand('netstat -ano')
  const lines = output.split(/\r?\n/)
  const results: PortProcess[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('Proto') || line.startsWith('Active')) {
      continue
    }
    const parts = line.split(/\s+/)
    if (parts.length < 4) {
      continue
    }

    const protocol = parts[0].toUpperCase()
    let localAddress = ''
    let pidText = ''

    if (protocol === 'TCP') {
      if (parts.length < 5) {
        continue
      }
      localAddress = parts[1]
      const state = parts[3]
      if (state !== 'LISTENING') {
        continue
      }
      pidText = parts[4]
    } else if (protocol === 'UDP') {
      localAddress = parts[1]
      pidText = parts[3]
    } else {
      continue
    }

    const pid = Number.parseInt(pidText, 10)
    if (!Number.isFinite(pid)) {
      continue
    }

    const addressInfo = parseAddress(localAddress)
    if (!addressInfo) {
      continue
    }

    results.push({
      pid,
      port: addressInfo.port,
      protocol,
      address: addressInfo.address,
    })
  }

  return results
}

async function enrichProcesses(base: PortProcess[]): Promise<PortProcess[]> {
  const pids = [...new Set(base.map((item) => item.pid))]
  const pidDetails = new Map<number, string>()

  await Promise.all(
    pids.map(async (pid) => {
      try {
        const matches = await findProcess('pid', pid)
        if (matches.length > 0) {
          const detail = matches[0]
          pidDetails.set(pid, detail.cmd ?? detail.name ?? '')
        }
      } finally {
        pidDetails.set(pid, '')
      }
    })
  )

  return base.map((item) => {
    if (item.command) {
      return item
    }
    const command = pidDetails.get(item.pid)
    return {
      ...item,
      command,
    }
  })
}

export async function listListeningProcesses(): Promise<PortProcess[]> {
  const base =
    process.platform === 'win32'
      ? await getWindowsProcesses()
      : await getUnixProcesses()
  const enriched = await enrichProcesses(base)
  return enriched.sort((a, b) => {
    if (a.port === b.port) {
      return a.pid - b.pid
    }
    return a.port - b.port
  })
}

export async function filterByPort(port: number): Promise<PortProcess[]> {
  const processes = await listListeningProcesses()
  return processes.filter((item) => item.port === port)
}

export async function filterByPortRange(
  minPort: number,
  maxPort: number
): Promise<PortProcess[]> {
  if (minPort > maxPort) {
    return []
  }
  const processes = await listListeningProcesses()
  return processes.filter(
    (item) => item.port >= minPort && item.port <= maxPort
  )
}

async function terminateProcess(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await execAsync(`taskkill /PID ${pid} /T /F`)
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ESRCH') {
      return
    }
    throw error
  }
}

export async function killByPort(port: number): Promise<{
  success: PortProcess[]
  failed: { process: PortProcess; error: Error }[]
}> {
  const matches = await filterByPort(port)
  const success: PortProcess[] = []
  const failed: { process: PortProcess; error: Error }[] = []

  await Promise.all(
    matches.map(async (processInfo) => {
      try {
        await terminateProcess(processInfo.pid)
        success.push(processInfo)
      } catch (error) {
        failed.push({ process: processInfo, error: error as Error })
      }
    })
  )

  return { success, failed }
}

export function formatProcess(processInfo: PortProcess): string {
  const pieces = [
    `${processInfo.protocol}/${processInfo.port}`,
    `pid:${processInfo.pid}`,
    `addr:${processInfo.address}`,
  ]
  if (processInfo.command) {
    pieces.push(processInfo.command)
  }
  return pieces.join(' ')
}

export async function killByPid(pid: number): Promise<void> {
  await terminateProcess(pid)
}
