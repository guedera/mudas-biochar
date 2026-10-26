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

/** Meses entre dois períodos "YYYY-MM" (de "2026-09" até "2026-10" = 1). */
function mesesEntre(de, ate) {
  const [anoDe, mesDe] = de.split('-').map(Number)
  const [anoAte, mesAte] = ate.split('-').map(Number)
  return (anoAte - anoDe) * 12 + (mesAte - mesDe)
}

/** Pontos de cada bloco (`{ periodo, valor }`, só os que têm valor), do mais
 * antigo pro mais recente. `dados` tem uma linha por bloco e período
 * (`{ bloco, periodo, [campoValor] }`), como em `/dashboard/evolucao-por-bloco`. */
function pontosPorBloco(dados, campoValor) {
  const pontos = new Map() // bloco -> [{ periodo, valor }]
  for (const linha of dados) {
    const valor = linha[campoValor]
    if (valor === null || valor === undefined) continue
    if (!pontos.has(linha.bloco)) pontos.set(linha.bloco, [])
    pontos.get(linha.bloco).push({ periodo: linha.periodo, valor })
  }
  for (const lista of pontos.values()) lista.sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
  return pontos
}

/** De um ranking já ordenado do menor pro maior, escolhe o menor, o do quarto
 * de baixo (25%), o do meio, o do quarto de cima (75%) e o maior — e devolve do
 * maior pro menor, cada um com a sua `posicao`. Com menos de 5 itens devolve só
 * os que existem. */
function escolherPosicoes(ranking) {
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

/** Os blocos que representam a distribuição da ÚLTIMA TAXA de crescimento de
 * uma medida: o de menor taxa, o de 25%, a mediana, o de 75% e o de maior taxa,
 * do maior pro menor.
 *
 * A taxa de um bloco é a inclinação do último trecho da linha dele no gráfico:
 * a variação entre os dois últimos pontos (os dois últimos meses em que o bloco
 * tem valor) dividida pelos meses entre eles — na unidade da medida, por mês
 * (cm/mês, mm/mês...). Pode ser negativa. Bloco com um ponto só não tem taxa e
 * fica de fora. Empate de taxa desempata pelo número do bloco. */
export function blocosPorTaxaAtual(dados, campoValor) {
  const ranking = []
  for (const [bloco, pontos] of pontosPorBloco(dados, campoValor)) {
    if (pontos.length < 2) continue
    const anterior = pontos[pontos.length - 2]
    const ultimo = pontos[pontos.length - 1]
    ranking.push({
      bloco,
      taxa: (ultimo.valor - anterior.valor) / mesesEntre(anterior.periodo, ultimo.periodo),
      valor: ultimo.valor,
      periodo: ultimo.periodo,
      periodoAnterior: anterior.periodo,
    })
  }
  ranking.sort((a, b) => a.taxa - b.taxa || a.bloco - b.bloco)
  return escolherPosicoes(ranking)
}

/** Igual a `blocosPorTaxaAtual`, mas ordenando pelo VALOR ATUAL de cada bloco: o
 * ponto mais recente da linha dele (o último mês em que tem valor), em vez da
 * inclinação. Serve pra medidas que são um nível acumulado, como a mortalidade,
 * onde a taxa empata em zero na maioria dos blocos. Empate de valor desempata
 * pelo número do bloco. */
export function blocosPorValorAtual(dados, campoValor) {
  const ranking = []
  for (const [bloco, pontos] of pontosPorBloco(dados, campoValor)) {
    const ultimo = pontos[pontos.length - 1]
    ranking.push({ bloco, valor: ultimo.valor, periodo: ultimo.periodo })
  }
  ranking.sort((a, b) => a.valor - b.valor || a.bloco - b.bloco)
  return escolherPosicoes(ranking)
}
