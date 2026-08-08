import { useEffect, useState } from 'react'
import {
  getDiametroPorTratamento,
  getEvolucao,
  getInjurias,
  getInjuriaVsSobrevivencia,
  getMortalidadePorTratamento,
  getResumoDashboard,
} from '../api'
import { ESPECIES, TRATAMENTOS } from '../constants'
import BarChart from '../components/BarChart'
import LineChart from '../components/LineChart'
import DivergingBarChart from '../components/DivergingBarChart'

function formatarPercentual(valor) {
  return `${valor}%`
}

function formatarMm(valor) {
  return `${valor} mm`
}

function formatarCm(valor) {
  return `${valor} cm`
}

function formatarDelta(valor) {
  const sinal = valor > 0 ? '+' : ''
  return `${sinal}${valor}pp`
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [mortalidade, setMortalidade] = useState(null)
  const [injurias, setInjurias] = useState(null)
  const [evolucao, setEvolucao] = useState(null)
  const [injuriaVsSobrevivencia, setInjuriaVsSobrevivencia] = useState(null)
  const [erro, setErro] = useState(null)

  const [especie, setEspecie] = useState(ESPECIES[0])
  const [diametro, setDiametro] = useState(null)

  const [tratamento, setTratamento] = useState(TRATAMENTOS[0])

  useEffect(() => {
    Promise.all([
      getResumoDashboard(),
      getMortalidadePorTratamento(),
      getInjurias(),
      getEvolucao(),
      getInjuriaVsSobrevivencia(),
    ])
      .then(([resumoRes, mortalidadeRes, injuriasRes, evolucaoRes, injuriaSobrevivenciaRes]) => {
        setResumo(resumoRes)
        setMortalidade(mortalidadeRes)
        setInjurias(injuriasRes)
        setEvolucao(evolucaoRes)
        setInjuriaVsSobrevivencia(injuriaSobrevivenciaRes)
      })
      .catch((err) => setErro(err.message))
  }, [])

  useEffect(() => {
    if (!especie) return
    getDiametroPorTratamento(especie)
      .then(setDiametro)
      .catch((err) => setErro(err.message))
  }, [especie])

  if (erro) return <p className="feedback error">{erro}</p>
  if (!resumo || !mortalidade || !injurias || !evolucao || !injuriaVsSobrevivencia) {
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
          titulo="Contagem de injúrias"
          colunaRotulo="Injúria"
          colunaValor="Ocorrências"
          dados={injurias.map((i) => ({ rotulo: i.injuria, valor: i.contagem }))}
        />

        <BarChart
          titulo={`Diâmetro médio por tratamento — ${especie}`}
          colunaRotulo="Tratamento"
          colunaValor="Diâmetro médio (mm)"
          dados={(diametro ?? []).map((d) => ({ rotulo: d.tratamento, valor: d.diametro_medio }))}
          formatarValor={formatarMm}
          extra={
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
          }
        />
      </section>

      <section className="dashboard-secao">
        <h2>Evolução ao longo do tempo</h2>
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
        <h2>Injúria x sobrevivência</h2>
        <DivergingBarChart
          titulo="Taxa de mortalidade por injúria, comparada à taxa geral"
          colunaRotulo="Injúria"
          colunaValor="Diferença (pontos percentuais)"
          dados={injuriaVsSobrevivencia.map((i) => ({ rotulo: i.injuria, valor: i.delta }))}
          formatarValor={formatarDelta}
          extra={
            <p className="secao-descricao">
              Taxa de mortalidade geral: <strong>{resumo.percentual_mortas}%</strong>. Barras à
              direita (vermelho) = injúria com mortalidade acima da média; à esquerda (verde) =
              abaixo da média.
            </p>
          }
        />
      </section>
    </div>
  )
}
