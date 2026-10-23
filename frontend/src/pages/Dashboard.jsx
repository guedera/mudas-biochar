import { useEffect, useState } from 'react'
import {
  getAlturaPorTratamento,
  getBlocos,
  getDiametroPorTratamento,
  getEvolucao,
  getEvolucaoPorBloco,
  getInjurias,
  getMortalidadePorBloco,
  getMortalidadePorTratamento,
  getResumoDashboard,
} from '../api'
import { ESPECIES, INJURIAS, TRATAMENTOS } from '../constants'
import BarChart from '../components/BarChart'
import LineChart from '../components/LineChart'
import DonutChart from '../components/DonutChart'

// Cor fixa por tipo de injúria (pela identidade do código, nunca pela
// posição/contagem dele nos dados) — mesma injúria sempre com a mesma cor.
const CORES_INJURIA = Object.fromEntries(
  INJURIAS.map((codigo, i) => [codigo, `var(--series-${i + 1})`]),
)

function formatarPercentual(valor) {
  return `${valor}%`
}

function formatarMm(valor) {
  return `${valor} mm`
}

function formatarCm(valor) {
  return `${valor} cm`
}

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

  const [tratamento, setTratamento] = useState(TRATAMENTOS[0])

  const [blocosDisponiveis, setBlocosDisponiveis] = useState([])
  const [bloco, setBloco] = useState(null)

  useEffect(() => {
    Promise.all([
      getResumoDashboard(),
      getMortalidadePorTratamento(),
      getMortalidadePorBloco(),
      getInjurias(),
      getEvolucao(),
      getEvolucaoPorBloco(),
      getBlocos(),
    ])
      .then(
        ([
          resumoRes,
          mortalidadeRes,
          mortalidadePorBlocoRes,
          injuriasRes,
          evolucaoRes,
          evolucaoPorBlocoRes,
          blocosRes,
        ]) => {
          setResumo(resumoRes)
          setMortalidade(mortalidadeRes)
          setMortalidadePorBloco(mortalidadePorBlocoRes)
          setInjurias(injuriasRes)
          setEvolucao(evolucaoRes)
          setEvolucaoPorBloco(evolucaoPorBlocoRes)
          setBlocosDisponiveis(blocosRes)
          setBloco((atual) => atual ?? blocosRes[0] ?? null)
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

  if (erro) return <p className="feedback error">{erro}</p>
  if (!resumo || !mortalidade || !mortalidadePorBloco || !injurias || !evolucao || !evolucaoPorBloco) {
    return <p>Carregando...</p>
  }

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
        <h2>Evolução ao longo do tempo - por tratamento</h2>
        <p className="secao-descricao">
          Cada gráfico destaca o tratamento escolhido (linha verde) contra os demais (cinza), mês
          a mês, considerando todas as medições — não só a mais recente.
        </p>
        <label className="chart-filtro">
          Tratamento em destaque
          <select value={tratamento} onChange={(e) => setTratamento(e.target.value)}>
            {TRATAMENTOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <LineChart
          titulo="Altura média ao longo do tempo"
          dados={evolucao}
          campoSerie="tratamento"
          campoPeriodo="periodo"
          campoValor="altura_media"
          destaque={tratamento}
          formatarValor={formatarCm}
          colunaValor="Altura média (cm)"
        />

        <LineChart
          titulo="Diâmetro médio ao longo do tempo"
          dados={evolucao}
          campoSerie="tratamento"
          campoPeriodo="periodo"
          campoValor="diametro_medio"
          destaque={tratamento}
          formatarValor={formatarMm}
          colunaValor="Diâmetro médio (mm)"
        />

        <LineChart
          titulo="Mortalidade acumulada ao longo do tempo"
          dados={evolucao}
          campoSerie="tratamento"
          campoPeriodo="periodo"
          campoValor="percentual_mortas_acumulado"
          destaque={tratamento}
          formatarValor={formatarPercentual}
          colunaValor="% mortalidade acumulada"
          maximoEixoY={100}
        />
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo — por bloco</h2>
        <p className="secao-descricao">
          Cada gráfico destaca o bloco escolhido (linha azul) contra os demais (cinza), mês a mês,
          considerando todas as medições — não só a mais recente.
        </p>
        <label className="chart-filtro">
          Bloco em destaque
          <select value={bloco ?? ''} onChange={(e) => setBloco(Number(e.target.value))}>
            {blocosDisponiveis.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <LineChart
          titulo="Altura média ao longo do tempo — por bloco"
          dados={evolucaoPorBloco}
          campoSerie="bloco"
          campoPeriodo="periodo"
          campoValor="altura_media"
          destaque={bloco}
          formatarValor={formatarCm}
          colunaValor="Altura média (cm)"
          colunaSerie="Bloco"
          cor="var(--info)"
        />

        <LineChart
          titulo="Diâmetro médio ao longo do tempo — por bloco"
          dados={evolucaoPorBloco}
          campoSerie="bloco"
          campoPeriodo="periodo"
          campoValor="diametro_medio"
          destaque={bloco}
          formatarValor={formatarMm}
          colunaValor="Diâmetro médio (mm)"
          colunaSerie="Bloco"
          cor="var(--info)"
        />

        <LineChart
          titulo="Mortalidade acumulada ao longo do tempo — por bloco"
          dados={evolucaoPorBloco}
          campoSerie="bloco"
          campoPeriodo="periodo"
          campoValor="percentual_mortas_acumulado"
          destaque={bloco}
          formatarValor={formatarPercentual}
          colunaValor="% mortalidade acumulada"
          colunaSerie="Bloco"
          maximoEixoY={100}
          cor="var(--info)"
        />
      </section>
    </div>
  )
}
