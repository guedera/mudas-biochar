const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08" -> "ago/26" (rótulo do eixo X dos gráficos de linha). */
export function formatarPeriodo(periodo) {
  const [ano, mes] = periodo.split('-')
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`
}
