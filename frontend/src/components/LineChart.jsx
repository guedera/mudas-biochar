const LARGURA = 640
const ALTURA = 220
const MARGEM = { topo: 16, baixo: 28, esquerda: 8, direita: 8 }

function formatarPeriodo(periodo) {
  const [ano, mes] = periodo.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`
}

function agruparPorSerie(dados, campoSerie, campoPeriodo, campoValor) {
  const porSerie = new Map()
  for (const linha of dados) {
    const chave = linha[campoSerie]
    if (!porSerie.has(chave)) porSerie.set(chave, [])
    porSerie.get(chave).push({ periodo: linha[campoPeriodo], valor: linha[campoValor] })
  }
  return porSerie
}

export default function LineChart({
  titulo,
  dados,
  campoSerie,
  campoPeriodo,
  campoValor,
  destaque,
  formatarValor = (v) => String(v),
  colunaValor = 'Valor',
  maximoEixoY,
  extra = null,
}) {
  const periodos = [...new Set(dados.map((d) => d[campoPeriodo]))].sort()
  const porSerie = agruparPorSerie(dados, campoSerie, campoPeriodo, campoValor)

  if (periodos.length === 0 || porSerie.size === 0) {
    return (
      <div className="chart">
        <h3>{titulo}</h3>
        {extra}
        <p className="chart-vazio">Sem dados suficientes ainda.</p>
      </div>
    )
  }

  const todosValores = dados.map((d) => d[campoValor]).filter((v) => v !== null && v !== undefined)
  const max = maximoEixoY ?? Math.max(...todosValores, 1)

  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo

  function x(periodo) {
    const i = periodos.indexOf(periodo)
    return periodos.length === 1
      ? MARGEM.esquerda + larguraUtil / 2
      : MARGEM.esquerda + (i / (periodos.length - 1)) * larguraUtil
  }

  function y(valor) {
    return MARGEM.topo + alturaUtil - (valor / max) * alturaUtil
  }

  function caminho(pontos) {
    const validos = pontos.filter((p) => p.valor !== null && p.valor !== undefined)
    return validos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.periodo)},${y(p.valor)}`).join(' ')
  }

  const seriesContexto = [...porSerie.entries()].filter(([chave]) => chave !== destaque)
  const pontosDestaque = destaque ? (porSerie.get(destaque) ?? []) : []
  const pontosDestaqueValidos = pontosDestaque.filter((p) => p.valor !== null && p.valor !== undefined)
  const ultimoPontoDestaque = pontosDestaqueValidos[pontosDestaqueValidos.length - 1]

  return (
    <div className="chart">
      <h3>{titulo}</h3>
      {extra}
      <svg
        className="linechart"
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="none"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            className="linechart-grid"
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={MARGEM.topo + alturaUtil * (1 - f)}
            y2={MARGEM.topo + alturaUtil * (1 - f)}
          />
        ))}

        {seriesContexto.map(([chave, pontos]) => (
          <path key={chave} className="linechart-contexto" d={caminho(pontos)} />
        ))}

        {destaque && (
          <>
            <path className="linechart-destaque" d={caminho(pontosDestaque)} />
            {pontosDestaqueValidos.map((p) => (
              <circle
                key={p.periodo}
                className="linechart-ponto"
                cx={x(p.periodo)}
                cy={y(p.valor)}
                r={4}
                tabIndex={0}
                aria-label={`${destaque}, ${formatarPeriodo(p.periodo)}: ${formatarValor(p.valor)}`}
              >
                <title>{`${destaque}, ${formatarPeriodo(p.periodo)}: ${formatarValor(p.valor)}`}</title>
              </circle>
            ))}
            {ultimoPontoDestaque && (
              <text
                className="linechart-rotulo"
                x={x(ultimoPontoDestaque.periodo)}
                y={y(ultimoPontoDestaque.valor) - 10}
                textAnchor="end"
              >
                {formatarValor(ultimoPontoDestaque.valor)}
              </text>
            )}
          </>
        )}

        {periodos.map((periodo) => (
          <text
            key={periodo}
            className="linechart-eixo-x"
            x={x(periodo)}
            y={ALTURA - 8}
            textAnchor="middle"
          >
            {formatarPeriodo(periodo)}
          </text>
        ))}
      </svg>

      <details className="chart-tabela">
        <summary>Ver dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Tratamento</th>
              <th>Período</th>
              <th>{colunaValor}</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((linha) => (
              <tr key={`${linha[campoSerie]}-${linha[campoPeriodo]}`}>
                <td>{linha[campoSerie]}</td>
                <td>{formatarPeriodo(linha[campoPeriodo])}</td>
                <td>
                  {linha[campoValor] === null || linha[campoValor] === undefined
                    ? '—'
                    : formatarValor(linha[campoValor])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
