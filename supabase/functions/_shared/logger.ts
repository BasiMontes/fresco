// Minimal structured logger for Edge Functions. Deno's console output is
// captured by Supabase's log drains as-is; emitting single-line JSON here
// makes those logs greppable/filterable instead of free-text.
//
// Utility convention (CLAUDE.md §10): silent-fail. A logging call must never
// throw or interrupt request handling — the try/catch below is the
// last-resort fallback for that guarantee, not defensive over-engineering.

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogFields {
  fn: string
  [key: string]: unknown
}

function emit(level: LogLevel, message: string, fields: LogFields): void {
  try {
    const line = JSON.stringify({ level, message, ts: new Date().toISOString(), ...fields })
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  } catch {
    console.log(`[${level}] ${message}`)
  }
}

export const logger = {
  info: (message: string, fields: LogFields) => emit('info', message, fields),
  warn: (message: string, fields: LogFields) => emit('warn', message, fields),
  error: (message: string, fields: LogFields) => emit('error', message, fields),
}
