const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function buildError(response) {
  const body = await response.json().catch(() => null)
  const detail = body?.detail
  const message =
    typeof detail === 'string' ? detail : (detail?.mensagem ?? `Erro ao salvar (${response.status})`)
  const error = new Error(message)
  error.detail = detail
  error.status = response.status
  return error
}

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) throw new Error(`Erro ao buscar dados (${response.status})`)
  return response.json()
}

async function sendJson(method, path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw await buildError(response)
  if (response.status === 204) return null
  return response.json()
}

function postJson(path, payload) {
  return sendJson('POST', path, payload)
}

function patchJson(path, payload) {
  return sendJson('PATCH', path, payload)
}

async function deleteRequest(path) {
  const response = await fetch(`${API_URL}${path}`, { method: 'DELETE' })
  if (!response.ok) throw await buildError(response)
}

export function createMedicao(payload) {
  return postJson('/medicoes', payload)
}

export function getResumoDashboard() {
  return getJson('/dashboard/resumo')
}

export function getMortalidadePorTratamento() {
  return getJson('/dashboard/mortalidade-por-tratamento')
}

export function getMortalidadePorBloco() {
  return getJson('/dashboard/mortalidade-por-bloco')
}

export function getInjurias() {
  return getJson('/dashboard/injurias')
}

function periodoParams(dataInicio, dataFim) {
  const params = new URLSearchParams()
  if (dataInicio) params.set('data_inicio', dataInicio)
  if (dataFim) params.set('data_fim', dataFim)
  return params.toString()
}

export function getDiametroPorTratamento(especie, dataInicio, dataFim) {
  const periodo = periodoParams(dataInicio, dataFim)
  return getJson(
    `/dashboard/diametro-por-tratamento?especie=${encodeURIComponent(especie)}${periodo ? `&${periodo}` : ''}`,
  )
}

export function getAlturaPorTratamento(especie, dataInicio, dataFim) {
  const periodo = periodoParams(dataInicio, dataFim)
  return getJson(
    `/dashboard/altura-por-tratamento?especie=${encodeURIComponent(especie)}${periodo ? `&${periodo}` : ''}`,
  )
}

export function getEvolucao() {
  return getJson('/dashboard/evolucao')
}

export function getEvolucaoPorEspecie(especie) {
  return getJson(`/dashboard/evolucao-por-especie?especie=${encodeURIComponent(especie)}`)
}

export function getEvolucaoPorBloco() {
  return getJson('/dashboard/evolucao-por-bloco')
}

export function getBlocos() {
  return getJson('/medicoes/blocos')
}

export function listSessoes() {
  return getJson('/sessoes')
}

export function createSessao(bloco) {
  return postJson('/sessoes', { bloco })
}

export function getSessao(id) {
  return getJson(`/sessoes/${id}`)
}

export function deleteSessao(id) {
  return deleteRequest(`/sessoes/${id}`)
}

export function addSessaoPlanta(sessaoId, payload) {
  return postJson(`/sessoes/${sessaoId}/plantas`, payload)
}

export function updateSessaoPlanta(sessaoId, plantaId, payload) {
  return patchJson(`/sessoes/${sessaoId}/plantas/${plantaId}`, payload)
}

export function deleteSessaoPlanta(sessaoId, plantaId) {
  return deleteRequest(`/sessoes/${sessaoId}/plantas/${plantaId}`)
}

export function finalizarSessao(sessaoId) {
  return postJson(`/sessoes/${sessaoId}/finalizar`, {})
}
