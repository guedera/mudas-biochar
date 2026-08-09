const TAMANHO = 200
const RAIO = 74
const ESPESSURA = 30
const CENTRO = TAMANHO / 2
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

function formatarPadrao(valor) {
  return `${valor}%`
}

/** Donut de "parte do todo": cada fatia é uma cor fixa por categoria
 * (passada em `dados[].cor`, escolhida pelo chamador com base na identidade
 * da categoria — nunca pela posição/ranking dela nos dados). */
export default function DonutChart({
  titulo,
  dados,
  colunaRotulo = 'Categoria',
  colunaValor = 'Valor',
  formatarValor = formatarPadrao,
}) {
  if (dados.length === 0) {
    return (
      <div className="chart">
        <h3>{titulo}</h3>
        <p className="chart-vazio">Sem dados suficientes ainda.</p>
      </div>
    )
  }

  const total = dados.reduce((soma, d) => soma + d.valor, 0)
  let acumulado = 0
  const fatias = dados.map((d) => {
    const fracao = total > 0 ? d.valor / total : 0
    const percentual = Math.round(fracao * 1000) / 10
    const inicio = acumulado
    acumulado += fracao
    return {
      ...d,
      percentual,
      dasharray: `${fracao * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`,
      dashoffset: -inicio * CIRCUNFERENCIA,
    }
  })

  return (
    <div className="chart">
      <h3>{titulo}</h3>
      <div className="donut-wrap">
        <svg className="donut" viewBox={`0 0 ${TAMANHO} ${TAMANHO}`} role="img" aria-label={titulo}>
          <g transform={`rotate(-90 ${CENTRO} ${CENTRO})`}>
            <circle
              cx={CENTRO}
              cy={CENTRO}
              r={RAIO}
              fill="none"
              stroke="var(--border)"
              strokeWidth={ESPESSURA}
            />
            {fatias.map((f) => (
              <circle
                key={f.rotulo}
                cx={CENTRO}
                cy={CENTRO}
                r={RAIO}
                fill="none"
                stroke={f.cor}
                strokeWidth={ESPESSURA}
                strokeDasharray={f.dasharray}
                strokeDashoffset={f.dashoffset}
                tabIndex={0}
              >
                <title>{`${f.rotulo}: ${formatarValor(f.percentual)}`}</title>
              </circle>
            ))}
          </g>
          <text x={CENTRO} y={CENTRO} textAnchor="middle" className="donut-total">
            {total}
          </text>
        </svg>

        <ul className="donut-legenda">
          {fatias.map((f) => (
            <li key={f.rotulo}>
              <span className="donut-legenda-cor" style={{ background: f.cor }} />
              {f.rotulo} — {formatarValor(f.percentual)}
            </li>
          ))}
        </ul>
      </div>

      <details className="chart-tabela">
        <summary>Ver dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>{colunaRotulo}</th>
              <th>{colunaValor}</th>
            </tr>
          </thead>
          <tbody>
            {fatias.map((f) => (
              <tr key={f.rotulo}>
                <td>{f.rotulo}</td>
                <td>{formatarValor(f.percentual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
