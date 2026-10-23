import { useEffect, useState } from 'react'
import { formatarPeriodo } from '../chartUtils'

const ALTURA = 240
const MARGEM = { topo: 14, baixo: 30, esquerda: 56, direita: 14 }
const RECUO_X = 14
const LARGURA_INICIAL = 560
const LARGURA_MIN = 240
const DIVISOES_Y = 4
const PASSOS_BONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/** Máximo "redondo" do eixo Y: 4 divisões iguais, cada uma num número limpo
 * (ex. dados até 14,3 -> eixo até 16, com marcas em 0/4/8/12/16). */
function maximoDoEixo(maiorValor, maximoFixo) {
  if (maximoFixo) return maximoFixo
  const bruto = maiorValor / DIVISOES_Y
  if (!(bruto > 0)) return 1
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = PASSOS_BONS.find((p) => p * potencia >= bruto) * potencia
  return passo * DIVISOES_Y
}

/** Gráfico de linhas com uma linha por série (ex. um tratamento), cada uma na
 * sua cor, e legenda ao lado. A cor vem de `cores[série]` — quem chama decide
 * pela identidade da série, nunca pela posição, então filtrar não repinta.
 * Série sem cor em `cores` não some: vira uma linha cinza ao fundo, de
 * contexto, sem legenda (ex. todos os blocos, com poucos em destaque).
 * `rotulos[série]` troca o texto da legenda (padrão: o próprio valor da série)
 * e `ordem` a ordem dela (padrão: a ordem em que as séries aparecem nos dados).
 * Passar o mouse (ou tocar/clicar) numa série da legenda destaca a linha. */
export default function MultiLineChart({
  titulo,
  dados,
  campoSerie,
  campoPeriodo,
  campoValor,
  cores,
  rotulos = {},
  ordem,
  formatarValor = (v) => String(v),
  colunaValor = 'Valor',
  colunaSerie = 'Tratamento',
  maximoEixoY,
}) {
  const [areaDoGrafico, setAreaDoGrafico] = useState(null)
  const [largura, setLargura] = useState(LARGURA_INICIAL)
  const [emHover, setEmHover] = useState(null)
  const [fixada, setFixada] = useState(null)

  // O SVG tem o tamanho real da área (e não um viewBox esticado), pra o texto
  // dos eixos manter o tamanho no celular.
  useEffect(() => {
    if (!areaDoGrafico) return
    const medir = () =>
      setLargura(Math.max(Math.round(areaDoGrafico.getBoundingClientRect().width), LARGURA_MIN))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(areaDoGrafico)
    return () => observador.disconnect()
  }, [areaDoGrafico])

  const valores = dados.map((d) => d[campoValor]).filter((v) => v !== null && v !== undefined)

  if (valores.length === 0) {
    return (
      <div className="chart">
        <h3>{titulo}</h3>
        <p className="chart-vazio">Sem dados suficientes ainda.</p>
      </div>
    )
  }

  const periodos = [...new Set(dados.map((d) => d[campoPeriodo]))].sort()
  const porSerie = new Map()
  for (const linha of dados) {
    const chave = linha[campoSerie]
    if (!porSerie.has(chave)) porSerie.set(chave, [])
    porSerie.get(chave).push({ periodo: linha[campoPeriodo], valor: linha[campoValor] })
  }
  const series = [...porSerie.keys()]
  const comCor = (ordem ?? series).filter((s) => porSerie.has(s) && cores[s] !== undefined)
  const contexto = series.filter((s) => cores[s] === undefined)
  const rotulo = (chave) => rotulos[chave] ?? chave

  const maximo = maximoDoEixo(Math.max(...valores), maximoEixoY)
  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo

  function x(periodo) {
    if (periodos.length === 1) return MARGEM.esquerda + larguraUtil / 2
    const i = periodos.indexOf(periodo)
    return MARGEM.esquerda + RECUO_X + (i / (periodos.length - 1)) * (larguraUtil - 2 * RECUO_X)
  }

  function y(valor) {
    return MARGEM.topo + alturaUtil - (valor / maximo) * alturaUtil
  }

  const comValor = (pontos) => pontos.filter((p) => p.valor !== null && p.valor !== undefined)

  function caminho(pontos) {
    return comValor(pontos)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.periodo)},${y(p.valor)}`)
      .join(' ')
  }

  const marcasY = Array.from({ length: DIVISOES_Y + 1 }, (_, i) =>
    Math.round((maximo / DIVISOES_Y) * i * 100) / 100,
  )

  const ativa = emHover ?? fixada
  // a série destacada é desenhada por último, por cima das outras
  const ordemDeDesenho = ativa === null ? comCor : [...comCor.filter((s) => s !== ativa), ativa]
  const opacidade = (chave) => (ativa === null || ativa === chave ? 1 : 0.15)

  return (
    <div className="chart">
      <h3>{titulo}</h3>

      <div className="multilinechart">
        <div className="multilinechart-plot" ref={setAreaDoGrafico}>
          <svg width={largura} height={ALTURA} viewBox={`0 0 ${largura} ${ALTURA}`} role="group" aria-label={titulo}>
            {marcasY.map((valor) => (
              <g key={valor}>
                <line
                  className="multilinechart-grade"
                  x1={MARGEM.esquerda}
                  x2={largura - MARGEM.direita}
                  y1={y(valor)}
                  y2={y(valor)}
                />
                <text
                  className="multilinechart-eixo"
                  x={MARGEM.esquerda - 8}
                  y={y(valor)}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {formatarValor(valor)}
                </text>
              </g>
            ))}

            {contexto.map((chave) => (
              <path key={chave} className="multilinechart-contexto" d={caminho(porSerie.get(chave))} />
            ))}

            {ordemDeDesenho.map((chave) => (
              <g key={chave} style={{ opacity: opacidade(chave) }} className="multilinechart-serie">
                <path
                  className="multilinechart-linha"
                  style={{ stroke: cores[chave] }}
                  d={caminho(porSerie.get(chave))}
                />
                {comValor(porSerie.get(chave)).map((p) => {
                  const descricao = `${rotulo(chave)}, ${formatarPeriodo(p.periodo)}: ${formatarValor(p.valor)}`
                  return (
                    <g
                      key={p.periodo}
                      className="multilinechart-ponto"
                      tabIndex={0}
                      aria-label={descricao}
                      onMouseEnter={() => setEmHover(chave)}
                      onMouseLeave={() => setEmHover(null)}
                      onFocus={() => setEmHover(chave)}
                      onBlur={() => setEmHover(null)}
                    >
                      <title>{descricao}</title>
                      <circle cx={x(p.periodo)} cy={y(p.valor)} r={12} fill="transparent" />
                      <circle
                        className="multilinechart-marca"
                        cx={x(p.periodo)}
                        cy={y(p.valor)}
                        r={4}
                        style={{ fill: cores[chave] }}
                      />
                    </g>
                  )
                })}
              </g>
            ))}

            {periodos.map((periodo) => (
              <text
                key={periodo}
                className="multilinechart-eixo"
                x={x(periodo)}
                y={ALTURA - 8}
                textAnchor="middle"
              >
                {formatarPeriodo(periodo)}
              </text>
            ))}
          </svg>
        </div>

        <ul className="multilinechart-legenda" aria-label={`Legenda: ${colunaSerie}`}>
          {comCor.map((chave) => (
            <li key={chave}>
              <button
                type="button"
                className="multilinechart-legenda-item"
                aria-pressed={fixada === chave}
                onMouseEnter={() => setEmHover(chave)}
                onMouseLeave={() => setEmHover(null)}
                onFocus={() => setEmHover(chave)}
                onBlur={() => setEmHover(null)}
                onClick={() => setFixada((atual) => (atual === chave ? null : chave))}
              >
                <span className="multilinechart-chave" style={{ background: cores[chave] }} />
                {rotulo(chave)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <details className="chart-tabela">
        <summary>Ver dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>{colunaSerie}</th>
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
