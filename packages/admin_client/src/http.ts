export class HermesApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorInfo?: string,
  ) {
    super(message)
    this.name = 'HermesApiError'
  }
}

export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new HermesApiError(
      body?.error || body?.message || `HTTP ${res.status}`,
      res.status,
      body?.error,
    )
  }

  const json = await res.json()
  if (json.success === false) {
    throw new HermesApiError(
      json.error || json.message || 'Request failed',
      res.status,
      json.error,
    )
  }

  return json.data as T
}
