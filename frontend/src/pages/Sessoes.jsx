import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSessao, deleteSessao, listSessoes } from '../api'

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

export default function Sessoes() {
  const navigate = useNavigate()
  const [sessoes, setSessoes] = useState(null)
  const [bloco, setBloco] = useState('')
  const [status, setStatus] = useState({ state: 'idle' })

  useEffect(() => {
    listSessoes()
      .then(setSessoes)
      .catch(() => setSessoes([]))
  }, [])

  async function handleRemoverSessao(sessao) {
    if (
      !window.confirm(
        `Tem certeza que quer remover a sessão do bloco ${sessao.bloco}? Todas as ${sessao.total_plantas} planta(s) lançadas nela serão perdidas. Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    try {
      await deleteSessao(sessao.id)
      setSessoes((prev) => prev.filter((s) => s.id !== sessao.id))
    } catch (err) {
      window.alert(err.message)
    }
  }

  async function handleCriar(event) {
    event.preventDefault()
    if (bloco.trim() === '' || Number.isNaN(Number(bloco))) {
      setStatus({ state: 'error', message: 'Informe o número do bloco.' })
      return
    }

    setStatus({ state: 'saving' })
    try {
      const sessao = await createSessao(Number(bloco))
      navigate(`/sessao/${sessao.id}`)
    } catch (err) {
      setStatus({ state: 'error', message: err.message, sessaoId: err.detail?.sessao_id })
    }
  }

  if (sessoes === null) return <p>Carregando...</p>

  const abertas = sessoes.filter((s) => !s.finalizada_em)
  const finalizadas = sessoes.filter((s) => s.finalizada_em)

  return (
    <div className="sessoes">
      <section className="relatorio-secao">
        <h2>Criar sessão</h2>
        <p className="secao-descricao">
          Uma sessão é uma coleta parcial de todas as plantas de um único bloco: primeiro
          espécie/tratamento/altura/folhas/viva/daninha/injúria de cada planta, depois, num
          segundo momento, o diâmetro de todas.
        </p>
        <form className="sessao-criar-form" onSubmit={handleCriar}>
          <label>
            Bloco
            <input
              type="number"
              inputMode="numeric"
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="salvar" disabled={status.state === 'saving'}>
            {status.state === 'saving' ? 'Criando...' : 'Criar sessão'}
          </button>
        </form>
        {status.state === 'error' && (
          <p className="feedback error">
            {status.message}{' '}
            {status.sessaoId && <Link to={`/sessao/${status.sessaoId}`}>Entrar na sessão existente</Link>}
          </p>
        )}
      </section>

      <section className="relatorio-secao">
        <h2>Sessões abertas</h2>
        {abertas.length === 0 && <p className="secao-descricao">Nenhuma sessão aberta.</p>}
        <ul className="sessao-lista">
          {abertas.map((s) => (
            <li key={s.id} className="sessao-lista-item sessao-planta-item">
              <Link to={`/sessao/${s.id}`}>
                <strong>Bloco {s.bloco}</strong>
                <span>
                  {s.total_completas}/{s.total_plantas} plantas completas
                </span>
                <span className="sessao-lista-data">criada em {formatarData(s.criada_em)}</span>
              </Link>
              <button
                type="button"
                className="sessao-remover"
                onClick={() => handleRemoverSessao(s)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>

      {finalizadas.length > 0 && (
        <section className="relatorio-secao">
          <h2>Sessões finalizadas</h2>
          <ul className="sessao-lista sessao-lista-historico">
            {finalizadas.map((s) => (
              <li key={s.id} className="sessao-lista-item">
                <Link to={`/sessao/${s.id}`}>
                  <strong>Bloco {s.bloco}</strong>
                  <span>{s.total_plantas} plantas</span>
                  <span className="sessao-lista-data">
                    finalizada em {formatarData(s.finalizada_em)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
