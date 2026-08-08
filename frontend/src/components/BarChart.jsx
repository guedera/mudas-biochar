function formatarPadrao(valor) {
  return String(valor)
}

export default function BarChart({
  titulo,
  colunaRotulo = 'Categoria',
  colunaValor = 'Valor',
  dados,
  formatarValor = formatarPadrao,
  extra = null,
}) {
  if (dados.length === 0) {
    return (
      <div className="chart">
        <h3>{titulo}</h3>
        {extra}
        <p className="chart-vazio">Sem dados suficientes ainda.</p>
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.valor), 1)

  return (
    <div className="chart">
      <h3>{titulo}</h3>
      {extra}
      <div className="chart-plot">
        {dados.map((d) => (
          <div className="chart-col" key={d.rotulo}>
            <div className="chart-bar-track">
              <span className="chart-bar-valor">{formatarValor(d.valor)}</span>
              <div
                className="chart-bar"
                style={{ height: `${(d.valor / max) * 100}%` }}
                tabIndex={0}
                data-tooltip={`${d.rotulo}: ${formatarValor(d.valor)}`}
                aria-label={`${d.rotulo}: ${formatarValor(d.valor)}`}
              />
            </div>
            <span className="chart-bar-rotulo">{d.rotulo}</span>
          </div>
        ))}
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
            {dados.map((d) => (
              <tr key={d.rotulo}>
                <td>{d.rotulo}</td>
                <td>{formatarValor(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
