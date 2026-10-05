import { send, setResponseStatus, setResponseHeader, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'
import { logger } from './utils/logger'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

// 自定义错误处理器：后端记录完整错误日志（含堆栈），但绝不向前端暴露堆栈
export default async function errorHandler(error: unknown, event: H3Event) {
  const err = (error ?? {}) as Record<string, any>
  const statusCode = err.statusCode || 500
  const statusMessage = err.statusMessage || 'Server Error'
  const message = err.message || '服务器内部错误'
  const url = event?.path || ''

  // 完整错误日志（含堆栈），便于排查
  logger.error(message || '未知错误', {
    statusCode,
    statusMessage,
    method: event?.method,
    url,
    stack: err.stack
  })

  // 安全响应头
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'x-frame-options', 'DENY')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')

  setResponseStatus(event, statusCode, statusMessage)

  const accept = getRequestHeader(event, 'accept') || ''
  const useJSON = !accept.includes('text/html')

  let body: string
  if (useJSON) {
    setResponseHeader(event, 'content-type', 'application/json')
    body = JSON.stringify({ error: true, url, statusCode, statusMessage, message })
  } else {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    body =
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${statusCode} ${statusMessage}</title></head>` +
      `<body><h2>${statusCode} ${escapeHtml(statusMessage)}</h2><p>${escapeHtml(message)}</p></body></html>`
  }

  // 标记已处理（send 会设置 writableEnded，避免内置错误处理器再次输出）
  return send(event, body)
}
