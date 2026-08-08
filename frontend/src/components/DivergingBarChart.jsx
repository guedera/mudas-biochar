export default function DivergingBarChart({
  titulo,
  dados,
  colunaRotulo = 'Categoria',
  colunaValor = 'Valor',
  formatarValor = (v) => String(v),
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

  const maxAbs = Math.max(...dados.map((d) => Math.abs(d.valor)), 1)

  return (
    <div className="chart">
      <h3>{titulo}</h3>
      {extra}
      <div className="diverging">
        {dados.map((d) => {
          const positivo = d.valor >= 0
          const pct = (Math.abs(d.valor) / maxAbs) * 48
          return (
            <div className="diverging-row" key={d.rotulo}>
              <span className="diverging-rotulo">{d.rotulo}</span>
              <div className="diverging-track">
                <span className="diverging-zero" />
                <div
                  className={`diverging-bar ${positivo ? 'diverging-positivo' : 'diverging-negativo'}`}
                  style={{ width: `${pct}%`, [positivo ? 'left' : 'right']: '50%' }}
                  tabIndex={0}
                  data-tooltip={`${d.rotulo}: ${formatarValor(d.valor)}`}
                  aria-label={`${d.rotulo}: ${formatarValor(d.valor)}`}
                />
                <span
                  className="diverging-valor"
                  style={{ [positivo ? 'left' : 'right']: `calc(50% + ${pct}% + 6px)` }}
                >
                  {formatarValor(d.valor)}
                </span>
              </div>
            </div>
          )
        })}
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
