import { useEffect, useState } from 'react'
import {
  getAlturaPorTratamento,
  getDiametroPorTratamento,
  getEvolucao,
  getEvolucaoPorBloco,
  getEvolucaoPorEspecie,
  getInjurias,
  getMortalidadePorBloco,
  getMortalidadePorTratamento,
  getResumoDashboard,
} from '../api'
import { ESPECIES, INJURIAS, TRATAMENTOS } from '../constants'
import { POSICOES_DA_DISTRIBUICAO, blocosPorValorAtual } from '../chartUtils'
import BarChart from '../components/BarChart'
import MultiLineChart from '../components/MultiLineChart'
import DonutChart from '../components/DonutChart'

// Cor fixa por tipo de injúria (pela identidade do código, nunca pela
// posição/contagem dele nos dados) — mesma injúria sempre com a mesma cor.
const CORES_INJURIA = Object.fromEntries(
  INJURIAS.map((codigo, i) => [codigo, `var(--series-${i + 1})`]),
)

// Mesma ideia pros tratamentos (T0-T8 -> --series-1..9): cada tratamento tem
// sempre a mesma cor em todos os gráficos de linha.
const CORES_TRATAMENTO = Object.fromEntries(
  TRATAMENTOS.map((tratamento, i) => [tratamento, `var(--series-${i + 1})`]),
)

// Os blocos em cor no "por bloco" são posições na distribuição do valor atual
// (o número do bloco que ocupa cada posição muda quando entram medições novas),
// então a cor segue a posição — a mesma posição tem sempre a mesma cor.
const COR_POSICAO_BLOCO = {
  maior: 'var(--series-1)',
  '75%': 'var(--series-2)',
  mediana: 'var(--series-3)',
  '25%': 'var(--series-4)',
  menor: 'var(--series-5)',
}

function formatarPercentual(valor) {
  return `${valor}%`
}

function formatarMm(valor) {
  return `${valor} mm`
}

function formatarCm(valor) {
  return `${valor} cm`
}

// Os 3 gráficos de linha que se repetem nas seções de evolução por espécie e
// por tratamento.
const METRICAS_EVOLUCAO = [
  {
    titulo: 'Altura média ao longo do tempo',
    campoValor: 'altura_media',
    formatarValor: formatarCm,
    colunaValor: 'Altura média (cm)',
  },
  {
    titulo: 'Diâmetro médio ao longo do tempo',
    campoValor: 'diametro_medio',
    formatarValor: formatarMm,
    colunaValor: 'Diâmetro médio (mm)',
  },
  {
    titulo: 'Mortalidade acumulada ao longo do tempo',
    campoValor: 'percentual_mortas_acumulado',
    formatarValor: formatarPercentual,
    colunaValor: '% mortalidade acumulada',
    // a mortalidade é baixa: o eixo vai até 25% (e cresce sozinho se algum
    // dado passar disso, em vez de cortar a linha)
    eixoYAte: 25,
  },
]

function formatarDataBr(iso) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarPeriodo(dataInicio, dataFim) {
  if (dataInicio && dataFim) return ` (${formatarDataBr(dataInicio)} a ${formatarDataBr(dataFim)})`
  if (dataInicio) return ` (a partir de ${formatarDataBr(dataInicio)})`
  if (dataFim) return ` (até ${formatarDataBr(dataFim)})`
  return ''
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [mortalidade, setMortalidade] = useState(null)
  const [mortalidadePorBloco, setMortalidadePorBloco] = useState(null)
  const [injurias, setInjurias] = useState(null)
  const [evolucao, setEvolucao] = useState(null)
  const [evolucaoPorBloco, setEvolucaoPorBloco] = useState(null)
  const [erro, setErro] = useState(null)

  const [especie, setEspecie] = useState(ESPECIES[0])
  const [diametro, setDiametro] = useState(null)
  const [altura, setAltura] = useState(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [especieEvolucao, setEspecieEvolucao] = useState(ESPECIES[0])
  const [evolucaoEspecie, setEvolucaoEspecie] = useState(null)

  useEffect(() => {
    Promise.all([
      getResumoDashboard(),
      getMortalidadePorTratamento(),
      getMortalidadePorBloco(),
      getInjurias(),
      getEvolucao(),
      getEvolucaoPorBloco(),
    ])
      .then(
        ([
          resumoRes,
          mortalidadeRes,
          mortalidadePorBlocoRes,
          injuriasRes,
          evolucaoRes,
          evolucaoPorBlocoRes,
        ]) => {
          setResumo(resumoRes)
          setMortalidade(mortalidadeRes)
          setMortalidadePorBloco(mortalidadePorBlocoRes)
          setInjurias(injuriasRes)
          setEvolucao(evolucaoRes)
          setEvolucaoPorBloco(evolucaoPorBlocoRes)
        },
      )
      .catch((err) => setErro(err.message))
  }, [])

  useEffect(() => {
    if (!especie) return
    Promise.all([
      getDiametroPorTratamento(especie, dataInicio, dataFim),
      getAlturaPorTratamento(especie, dataInicio, dataFim),
    ])
      .then(([diametroRes, alturaRes]) => {
        setDiametro(diametroRes)
        setAltura(alturaRes)
      })
      .catch((err) => setErro(err.message))
  }, [especie, dataInicio, dataFim])

  useEffect(() => {
    // `atual` descarta a resposta de uma espécie que já não é a selecionada
    // (troca rápida no dropdown, resposta antiga chegando depois da nova)
    let atual = true
    getEvolucaoPorEspecie(especieEvolucao)
      .then((res) => {
        if (atual) setEvolucaoEspecie(res)
      })
      .catch((err) => {
        if (atual) setErro(err.message)
      })
    return () => {
      atual = false
    }
  }, [especieEvolucao])

  if (erro) return <p className="feedback error">{erro}</p>
  if (!resumo || !mortalidade || !mortalidadePorBloco || !injurias || !evolucao || !evolucaoPorBloco) {
    return <p>Carregando...</p>
  }

  // Em cada gráfico "por bloco", os blocos em cor são os de menor/25%/mediana/75%/maior
  // valor ATUAL daquela medida — calculado dos mesmos pontos que o gráfico desenha, então a
  // legenda sempre bate com a linha que termina mais alta (ou mais baixa) na tela.
  const graficosPorBloco = METRICAS_EVOLUCAO.map((metrica) => {
    const destaques = blocosPorValorAtual(evolucaoPorBloco, metrica.campoValor)
    return {
      metrica,
      destaques,
      cores: Object.fromEntries(destaques.map((d) => [d.bloco, COR_POSICAO_BLOCO[d.posicao]])),
      rotulos: Object.fromEntries(destaques.map((d) => [d.bloco, `Bloco ${d.bloco} · ${d.posicao}`])),
    }
  })

  return (
    <div className="dashboard">
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-label">Plantas monitoradas</span>
          <span className="stat-valor">{resumo.total_plantas}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Vivas</span>
          <span className="stat-valor">{resumo.total_vivas}</span>
        </div>
        <div className="stat-tile stat-tile-danger">
          <span className="stat-label">Mortas</span>
          <span className="stat-valor">
            {resumo.total_mortas} ({resumo.percentual_mortas}%)
          </span>
        </div>
      </div>

      <section className="dashboard-secao">
        <h2>Estado atual</h2>

        <BarChart
          titulo="Mortalidade por tratamento (% das plantas mortas)"
          colunaRotulo="Tratamento"
          colunaValor="% das plantas mortas"
          dados={mortalidade.map((m) => ({ rotulo: m.tratamento, valor: m.percentual }))}
          formatarValor={formatarPercentual}
        />

        <BarChart
          titulo="Mortalidade por bloco (% das plantas mortas)"
          colunaRotulo="Bloco"
          colunaValor="% das plantas mortas"
          dados={mortalidadePorBloco.map((m) => ({ rotulo: m.bloco, valor: m.percentual }))}
          formatarValor={formatarPercentual}
          cor="var(--info)"
        />

        <BarChart
          titulo="Contagem de injúrias"
          colunaRotulo="Injúria"
          colunaValor="Ocorrências"
          dados={injurias.map((i) => ({ rotulo: i.injuria, valor: i.contagem }))}
        />

        <DonutChart
          titulo="Distribuição das injúrias (% das ocorrências)"
          colunaRotulo="Injúria"
          colunaValor="% das ocorrências"
          dados={injurias.map((i) => ({
            rotulo: i.injuria,
            valor: i.contagem,
            cor: CORES_INJURIA[i.injuria],
          }))}
        />

        <div className="chart-filtros">
          <label className="chart-filtro">
            Espécie
            <select value={especie} onChange={(e) => setEspecie(e.target.value)}>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="chart-filtro">
            Data 1
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </label>
          <label className="chart-filtro">
            Data 2
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </label>
        </div>
        <p className="secao-descricao">
          Sem datas, mostra o estado atual de cada planta (última medição). Com Data 1 e/ou Data 2
          preenchidas, mostra a média de todas as medições feitas dentro desse período.
        </p>

        <BarChart
          titulo={`Diâmetro médio por tratamento — ${especie}${formatarPeriodo(dataInicio, dataFim)}`}
          colunaRotulo="Tratamento"
          colunaValor="Diâmetro médio (mm)"
          dados={(diametro ?? []).map((d) => ({ rotulo: d.tratamento, valor: d.diametro_medio }))}
          formatarValor={formatarMm}
        />

        <BarChart
          titulo={`Altura média por tratamento — ${especie}${formatarPeriodo(dataInicio, dataFim)}`}
          colunaRotulo="Tratamento"
          colunaValor="Altura média (cm)"
          dados={(altura ?? []).map((a) => ({ rotulo: a.tratamento, valor: a.altura_media }))}
          formatarValor={formatarCm}
        />
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo - por espécie</h2>
        <p className="secao-descricao">
          Escolha uma espécie: cada linha é um tratamento (cores na legenda), mês a mês,
          considerando todas as medições dessa espécie — não só a mais recente. Passe o mouse (ou
          toque) num tratamento da legenda pra destacar a linha dele.
        </p>
        <label className="chart-filtro">
          Espécie
          <select value={especieEvolucao} onChange={(e) => setEspecieEvolucao(e.target.value)}>
            {ESPECIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        {METRICAS_EVOLUCAO.map((metrica) => (
          <MultiLineChart
            key={metrica.campoValor}
            titulo={`${metrica.titulo} — ${especieEvolucao}`}
            dados={evolucaoEspecie ?? []}
            campoSerie="tratamento"
            campoPeriodo="periodo"
            campoValor={metrica.campoValor}
            cores={CORES_TRATAMENTO}
            formatarValor={metrica.formatarValor}
            colunaValor={metrica.colunaValor}
            eixoYAte={metrica.eixoYAte}
          />
        ))}
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo - por tratamento</h2>
        <p className="secao-descricao">
          Cada linha é um tratamento (cores na legenda), mês a mês, considerando todas as medições
          de todas as espécies — não só a mais recente. Passe o mouse (ou toque) num tratamento da
          legenda pra destacar a linha dele.
        </p>

        {METRICAS_EVOLUCAO.map((metrica) => (
          <MultiLineChart
            key={metrica.campoValor}
            titulo={metrica.titulo}
            dados={evolucao}
            campoSerie="tratamento"
            campoPeriodo="periodo"
            campoValor={metrica.campoValor}
            cores={CORES_TRATAMENTO}
            formatarValor={metrica.formatarValor}
            colunaValor={metrica.colunaValor}
            eixoYAte={metrica.eixoYAte}
          />
        ))}
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo — por bloco</h2>
        <p className="secao-descricao">
          Em cada gráfico, os blocos em cor (legenda) são os de <strong>menor</strong>, 25%,{' '}
          <strong>mediana</strong>, 75% e <strong>maior</strong> valor <strong>atual</strong> daquela
          medida — o ponto mais recente de cada linha. Os demais blocos aparecem em cinza, ao
          fundo. Mês a mês, considerando todas as medições — não só a mais recente.
        </p>

        <details className="chart-tabela">
          <summary>Como os blocos foram escolhidos</summary>
          <p className="secao-descricao">
            Cada bloco entra com o valor do ponto mais recente da linha dele (a média das medições
            do último mês em que foi medido). Os blocos são ordenados por esse valor, em cada
            medida, e os cinco em destaque são o primeiro, o do quarto de baixo, o do meio, o do
            quarto de cima e o último. Por isso o bloco em cor muda de um gráfico para o outro.
          </p>
          <table>
            <thead>
              <tr>
                <th>Posição</th>
                {graficosPorBloco.map(({ metrica }) => (
                  <th key={metrica.campoValor}>{metrica.colunaValor}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POSICOES_DA_DISTRIBUICAO.map((posicao) => (
                <tr key={posicao}>
                  <td>{posicao}</td>
                  {graficosPorBloco.map(({ metrica, destaques }) => {
                    const d = destaques.find((x) => x.posicao === posicao)
                    return (
                      <td key={metrica.campoValor}>
                        {d ? `Bloco ${d.bloco} · ${metrica.formatarValor(d.valor)}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {graficosPorBloco.map(({ metrica, destaques, cores, rotulos }) => (
          <MultiLineChart
            key={metrica.campoValor}
            titulo={`${metrica.titulo} — por bloco`}
            dados={evolucaoPorBloco}
            campoSerie="bloco"
            campoPeriodo="periodo"
            campoValor={metrica.campoValor}
            cores={cores}
            rotulos={rotulos}
            ordem={destaques.map((d) => d.bloco)}
            formatarValor={metrica.formatarValor}
            colunaValor={metrica.colunaValor}
            colunaSerie="Bloco"
            eixoYAte={metrica.eixoYAte}
          />
        ))}
      </section>
    </div>
  )
}
