const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08" -> "ago/26" (rótulo do eixo X dos gráficos de linha). */
export function formatarPeriodo(periodo) {
  const [ano, mes] = periodo.split('-')
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`
}

/** As posições escolhidas na distribuição, do maior pro menor valor. */
export const POSICOES_DA_DISTRIBUICAO = ['maior', '75%', 'mediana', '25%', 'menor']

// ordem em que as posições "reivindicam" um bloco quando há poucos blocos e duas
// caem no mesmo: os extremos primeiro, depois a mediana e os quartis
const FRACAO_DA_POSICAO = [
  ['maior', 1],
  ['menor', 0],
  ['mediana', 0.5],
  ['75%', 0.75],
  ['25%', 0.25],
]

/** Os blocos que representam a distribuição do valor ATUAL de uma medida: o de
 * menor valor, o de 25%, a mediana, o de 75% e o de maior, do maior pro menor.
 *
 * "Atual" é o ponto mais recente da linha de cada bloco no gráfico (o último
 * mês em que o bloco tem valor), então o "maior" é sempre a linha que termina
 * mais alta no que está desenhado. `dados` tem uma linha por bloco e período
 * (`{ bloco, periodo, [campoValor] }`), como em `/dashboard/evolucao-por-bloco`.
 * Com menos de 5 blocos devolve só os que existem; empate de valor desempata
 * pelo número do bloco. */
export function blocosPorValorAtual(dados, campoValor) {
  const atual = new Map() // bloco -> { periodo, valor } do ponto mais recente com valor
  for (const linha of dados) {
    const valor = linha[campoValor]
    if (valor === null || valor === undefined) continue
    const anterior = atual.get(linha.bloco)
    if (!anterior || linha.periodo > anterior.periodo) {
      atual.set(linha.bloco, { periodo: linha.periodo, valor })
    }
  }

  const ranking = [...atual.entries()]
    .map(([bloco, ponto]) => ({ bloco, ...ponto }))
    .sort((a, b) => a.valor - b.valor || a.bloco - b.bloco) // do menor pro maior
  if (ranking.length === 0) return []

  const escolhidos = new Map() // índice no ranking -> posição
  for (const [posicao, fracao] of FRACAO_DA_POSICAO) {
    const indice = Math.floor(fracao * (ranking.length - 1) + 0.5)
    if (!escolhidos.has(indice)) escolhidos.set(indice, posicao)
  }
  return [...escolhidos.entries()]
    .sort(([a], [b]) => b - a)
    .map(([indice, posicao]) => ({ ...ranking[indice], posicao }))
}
