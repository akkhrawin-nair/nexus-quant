export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : 'http://127.0.0.1:8001')

export async function apiRequest(path, { signal, timeoutMs = 30000, ...options } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('Request timed out. Retry when the data provider is available.')), timeoutMs)
  try {
    const response = await fetch(path.startsWith('http') ? path : `${API_BASE_URL}${path}`, {
      ...options, signal: controller.signal,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function numericValue(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function compareMacdStrength(a, b) {
  return Math.abs(numericValue(b.macd) ?? 0) - Math.abs(numericValue(a.macd) ?? 0)
}
