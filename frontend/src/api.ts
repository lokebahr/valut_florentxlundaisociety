const API_BASE = ''

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH'

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('valut_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function api<T>(
  path: string,
  opts: { method?: HttpMethod; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = opts
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = text && isJson ? JSON.parse(text) : {}
  if (!res.ok) {
    const d = data as { error?: string; detail?: string }
    const fallback = text && !isJson ? `${res.status} ${res.statusText}` : res.statusText
    const msg = [d.error || fallback, d.detail].filter(Boolean).join(' — ')
    throw new Error(msg)
  }
  return data as T
}
