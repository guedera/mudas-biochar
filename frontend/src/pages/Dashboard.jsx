import { useEffect, useState } from 'react'
import {
  getAlturaPorTratamento,
  getBlocosPorCrescimento,
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
import BarChart from '../components/BarChart'
import MultiLineChart from '../components/MultiLineChart'
import DonutChart from '../components/DonutChart'

// Cor fixa por tipo de injúria (pela identidade do código, nunca pela
// posição/contagem dele nos dados) — mesma injúria sempre com a mesma cor.
const CORES_INJURIA = Object.fromEntries(
  INJURIAS.map((codigo, i) => [codigo, `var(--series-${i + 1})`]),
)

// Mesma ideia pros tratamentos (T0-T9 -> --series-1..10): cada tratamento tem
// sempre a mesma cor em todos os gráficos de linha.
const CORES_TRATAMENTO = Object.fromEntries(
  TRATAMENTOS.map((tratamento, i) => [tratamento, `var(--series-${i + 1})`]),
)

// Os blocos em cor no "por bloco" são posições no ranking de crescimento (o
// número do bloco muda quando entram medições novas), então a cor segue a
// posição — a mesma posição tem sempre a mesma cor.
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
    maximoEixoY: 100,
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

  const [blocosDestaque, setBlocosDestaque] = useState(null)

  useEffect(() => {
    Promise.all([
      getResumoDashboard(),
      getMortalidadePorTratamento(),
      getMortalidadePorBloco(),
      getInjurias(),
      getEvolucao(),
      getEvolucaoPorBloco(),
      getBlocosPorCrescimento(),
    ])
      .then(
        ([
          resumoRes,
          mortalidadeRes,
          mortalidadePorBlocoRes,
          injuriasRes,
          evolucaoRes,
          evolucaoPorBlocoRes,
          blocosDestaqueRes,
        ]) => {
          setResumo(resumoRes)
          setMortalidade(mortalidadeRes)
          setMortalidadePorBloco(mortalidadePorBlocoRes)
          setInjurias(injuriasRes)
          setEvolucao(evolucaoRes)
          setEvolucaoPorBloco(evolucaoPorBlocoRes)
          setBlocosDestaque(blocosDestaqueRes)
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
  if (
    !resumo ||
    !mortalidade ||
    !mortalidadePorBloco ||
    !injurias ||
    !evolucao ||
    !evolucaoPorBloco ||
    !blocosDestaque
  ) {
    return <p>Carregando...</p>
  }

  const coresBlocos = Object.fromEntries(
    blocosDestaque.map((b) => [b.bloco, COR_POSICAO_BLOCO[b.posicao]]),
  )
  const rotulosBlocos = Object.fromEntries(
    blocosDestaque.map((b) => [b.bloco, `Bloco ${b.bloco} · ${b.posicao}`]),
  )

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
            maximoEixoY={metrica.maximoEixoY}
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
            maximoEixoY={metrica.maximoEixoY}
          />
        ))}
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo — por bloco</h2>
        <p className="secao-descricao">
          Os blocos em cor (legenda) são escolhidos pela taxa de crescimento em altura e diâmetro:
          o de maior crescimento, o de 75%, a mediana, o de 25% e o de menor crescimento. Os demais
          blocos aparecem em cinza, ao fundo. Mês a mês, considerando todas as medições — não só a
          mais recente.
        </p>

        {blocosDestaque.length === 0 ? (
          <p className="secao-descricao">
            Ainda não há plantas medidas mais de uma vez, com pelo menos 1 dia de intervalo, pra
            calcular a taxa de crescimento — por isso nenhum bloco está em destaque.
          </p>
        ) : (
          <details className="chart-tabela">
            <summary>Como os blocos foram escolhidos</summary>
            <p className="secao-descricao">
              A taxa de crescimento de um bloco soma o quanto as plantas dele cresceram entre a
              primeira e a última medição e divide pelos dias entre elas (por mês de 30 dias).
              Altura e diâmetro pesam igual: o bloco é posicionado pela média da posição dele nos
              dois rankings. Só entram plantas medidas pelo menos duas vezes.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Bloco</th>
                  <th>Altura (cm/mês)</th>
                  <th>Diâmetro (mm/mês)</th>
                </tr>
              </thead>
              <tbody>
                {blocosDestaque.map((b) => (
                  <tr key={b.bloco}>
                    <td>{b.posicao}</td>
                    <td>{b.bloco}</td>
                    <td>{b.taxa_altura ?? '—'}</td>
                    <td>{b.taxa_diametro ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {METRICAS_EVOLUCAO.map((metrica) => (
          <MultiLineChart
            key={metrica.campoValor}
            titulo={`${metrica.titulo} — por bloco`}
            dados={evolucaoPorBloco}
            campoSerie="bloco"
            campoPeriodo="periodo"
            campoValor={metrica.campoValor}
            cores={coresBlocos}
            rotulos={rotulosBlocos}
            ordem={blocosDestaque.map((b) => b.bloco)}
            formatarValor={metrica.formatarValor}
            colunaValor={metrica.colunaValor}
            colunaSerie="Bloco"
            maximoEixoY={metrica.maximoEixoY}
          />
        ))}
      </section>
    </div>
  )
}
