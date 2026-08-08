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

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) throw new Error(`Erro ao buscar dados (${response.status})`)
  return response.json()
}

export function getResumoDashboard() {
  return getJson('/dashboard/resumo')
}

export function getMortalidadePorTratamento() {
  return getJson('/dashboard/mortalidade-por-tratamento')
}

export function getInjurias() {
  return getJson('/dashboard/injurias')
}

export function getDiametroPorTratamento(especie) {
  return getJson(`/dashboard/diametro-por-tratamento?especie=${encodeURIComponent(especie)}`)
}

export function getEvolucao() {
  return getJson('/dashboard/evolucao')
}

export function getInjuriaVsSobrevivencia() {
  return getJson('/dashboard/injuria-vs-sobrevivencia')
}
