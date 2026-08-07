const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export async function createMedicao(payload) {
  const response = await fetch(`${API_URL}/medicoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.detail ? JSON.stringify(body.detail) : `Erro ao salvar (${response.status})`,
    )
  }

  return response.json()
}
