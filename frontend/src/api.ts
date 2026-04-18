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
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const msg = (data as { error?: string }).error || res.statusText
    throw new Error(msg)
  }
  return data as T
}
