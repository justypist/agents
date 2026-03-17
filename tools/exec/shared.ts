import { spawn } from "node:child_process"
import { z } from "zod"

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 120_000
const DEFAULT_MAX_OUTPUT_LENGTH = 12_000
const MAX_OUTPUT_LENGTH = 20_000
const FORCE_KILL_DELAY_MS = 1_000

type CommandOutcome =
  | { type: "timeout" }
  | { type: "exit"; exitCode: number }

export type CommandExecutionResult = {
  stdout: string
  stderr: string
  outcome: CommandOutcome
}

export type CommandInput = {
  command: string
  timeoutMs?: number
  maxOutputLength?: number
}

export type CodeInput = {
  code: string
  timeoutMs?: number
  maxOutputLength?: number
}

function createAbortError() {
  const error = new Error("Aborted")
  error.name = "AbortError"
  return error
}

function clampTimeoutMs(timeoutMs: number | undefined) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS
  }

  return Math.min(Math.max(Math.floor(timeoutMs), 1_000), MAX_TIMEOUT_MS)
}

function clampMaxOutputLength(maxOutputLength: number | undefined) {
  if (
    typeof maxOutputLength !== "number" ||
    !Number.isFinite(maxOutputLength)
  ) {
    return DEFAULT_MAX_OUTPUT_LENGTH
  }

  return Math.min(Math.max(Math.floor(maxOutputLength), 1_000), MAX_OUTPUT_LENGTH)
}

function appendChunk(current: string, chunk: string, hardLimit: number) {
  if (current.length >= hardLimit || chunk.length === 0) {
    return current
  }

  const next = current + chunk

  if (next.length <= hardLimit) {
    return next
  }

  return next.slice(0, hardLimit)
}

function truncateOutput(output: string, maxOutputLength: number) {
  if (output.length <= maxOutputLength) {
    return output
  }

  return `${output.slice(0, maxOutputLength)}\n... [output truncated]`
}

async function executeProcess(
  executable: string,
  args: string[],
  timeoutMs: number,
  maxOutputLength: number,
  abortSignal?: AbortSignal
): Promise<CommandExecutionResult> {
  return await new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(createAbortError())
      return
    }

    const hardLimit = maxOutputLength * 2
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let didAbort = false
    let didTimeout = false
    let didSettle = false
    let forceKillTimer: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      if (forceKillTimer) {
        clearTimeout(forceKillTimer)
      }
      if (abortSignal) {
        abortSignal.removeEventListener("abort", handleAbort)
      }
    }

    const resolveOnce = (result: CommandExecutionResult) => {
      if (didSettle) {
        return
      }

      didSettle = true
      cleanup()
      resolve({
        stdout: truncateOutput(result.stdout, maxOutputLength),
        stderr: truncateOutput(result.stderr, maxOutputLength),
        outcome: result.outcome,
      })
    }

    const rejectOnce = (error: Error) => {
      if (didSettle) {
        return
      }

      didSettle = true
      cleanup()
      reject(error)
    }

    const terminateChild = () => {
      child.kill("SIGTERM")
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL")
      }, FORCE_KILL_DELAY_MS)
    }

    const handleAbort = () => {
      didAbort = true
      terminateChild()
    }

    const timeoutTimer: NodeJS.Timeout = setTimeout(() => {
      didTimeout = true
      terminateChild()
    }, timeoutMs)

    if (abortSignal) {
      abortSignal.addEventListener("abort", handleAbort, { once: true })
    }

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")

    child.stdout.on("data", (chunk: string) => {
      stdout = appendChunk(stdout, chunk, hardLimit)
    })

    child.stderr.on("data", (chunk: string) => {
      stderr = appendChunk(stderr, chunk, hardLimit)
    })

    child.on("error", (error: Error) => {
      if (didAbort) {
        rejectOnce(createAbortError())
        return
      }

      resolveOnce({
        stdout,
        stderr: appendChunk(stderr, error.message, hardLimit),
        outcome: { type: "exit", exitCode: 1 },
      })
    })

    child.on("close", (code: number | null) => {
      if (didAbort) {
        rejectOnce(createAbortError())
        return
      }

      if (didTimeout) {
        resolveOnce({
          stdout,
          stderr,
          outcome: { type: "timeout" },
        })
        return
      }

      resolveOnce({
        stdout,
        stderr,
        outcome: { type: "exit", exitCode: code ?? 1 },
      })
    })
  })
}

export async function executeBashCommand(
  input: CommandInput,
  abortSignal?: AbortSignal
) {
  return await executeProcess(
    "bash",
    ["-lc", input.command],
    clampTimeoutMs(input.timeoutMs),
    clampMaxOutputLength(input.maxOutputLength),
    abortSignal
  )
}

export async function executeJavaScript(
  input: CodeInput,
  abortSignal?: AbortSignal
) {
  return await executeProcess(
    "node",
    ["-e", input.code],
    clampTimeoutMs(input.timeoutMs),
    clampMaxOutputLength(input.maxOutputLength),
    abortSignal
  )
}

export async function executePython(
  input: CodeInput,
  abortSignal?: AbortSignal
) {
  return await executeProcess(
    "python3",
    ["-c", input.code],
    clampTimeoutMs(input.timeoutMs),
    clampMaxOutputLength(input.maxOutputLength),
    abortSignal
  )
}

export const commandInputSchema = z.object({
  command: z.string().describe("要执行的 bash 命令"),
  timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).optional(),
  maxOutputLength: z.number().int().positive().max(MAX_OUTPUT_LENGTH).optional(),
})

export const codeInputSchema = z.object({
  code: z.string().describe("要执行的代码"),
  timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).optional(),
  maxOutputLength: z.number().int().positive().max(MAX_OUTPUT_LENGTH).optional(),
})

export const commandOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  outcome: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("timeout"),
    }),
    z.object({
      type: z.literal("exit"),
      exitCode: z.number(),
    }),
  ]),
})
