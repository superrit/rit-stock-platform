// 结构化 JSON 日志，便于排查问题
function write(level: 'error' | 'warn' | 'info', message: string, meta?: Record<string, unknown>) {
  const entry = { level, time: new Date().toISOString(), message, ...meta }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta)
}
