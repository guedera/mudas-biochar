import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteSessao, deleteSessaoPlanta, finalizarSessao, getSessao } from '../api'
import SessaoStatusBar from '../components/SessaoStatusBar'

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

export default function SessaoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sessao, setSessao] = useState(null)
  const [erro, setErro] = useState(null)
  const [finalizando, setFinalizando] = useState(false)

  function recarregar() {
    return getSessao(id)
      .then(setSessao)
      .catch(() => setErro('Não foi possível carregar a sessão.'))
  }

  useEffect(() => {
    recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleRemover(plantaId, especie, tratamento) {
    if (!window.confirm(`Tem certeza que quer remover a planta ${especie}/${tratamento} desta sessão? Essa ação não pode ser desfeita.`)) {
      return
    }
    try {
      await deleteSessaoPlanta(id, plantaId)
      recarregar()
    } catch (err) {
      setErro(err.message)
    }
  }

  async function handleFinalizar() {
    setFinalizando(true)
    setErro(null)
    try {
      await finalizarSessao(id)
      recarregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setFinalizando(false)
    }
  }

  async function handleRemoverSessao() {
    if (
      !window.confirm(
        `Tem certeza que quer remover a sessão do bloco ${sessao.bloco}? Todas as ${sessao.total_plantas} planta(s) lançadas nela serão perdidas. Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    try {
      await deleteSessao(id)
      navigate('/sessao')
    } catch (err) {
      setErro(err.message)
    }
  }

  if (erro && !sessao) return <p className="feedback error">{erro}</p>
  if (!sessao) return <p>Carregando...</p>

  const aberta = !sessao.finalizada_em
  const podeFinalizar =
    aberta && sessao.total_plantas > 0 && sessao.total_completas === sessao.total_plantas
  const primeiraPlanta = sessao.plantas[0]

  return (
    <div className="sessao-detalhe">
      <SessaoStatusBar sessao={sessao} />

      {!aberta && (
        <p className="feedback success">
          Sessão finalizada em {formatarData(sessao.finalizada_em)} — enviada pro banco
          definitivo de medições.
        </p>
      )}

      <ul className="sessao-lista sessao-plantas-lista">
        {sessao.plantas.length === 0 && (
          <p className="secao-descricao">Nenhuma planta lançada ainda nesta sessão.</p>
        )}
        {sessao.plantas.map((p) => (
          <li key={p.id} className="sessao-lista-item sessao-planta-item">
            {aberta ? (
              <Link to={`/sessao/${id}/revisar/${p.id}`}>
                <strong>
                  {p.especie} / {p.tratamento}
                </strong>
                <span className={p.completa ? 'sessao-badge-ok' : 'sessao-badge-pendente'}>
                  {p.completa ? '✅ completa' : '⚠️ falta diâmetro'}
                </span>
              </Link>
            ) : (
              <span>
                <strong>
                  {p.especie} / {p.tratamento}
                </strong>
                <span className="sessao-badge-ok">✅ completa</span>
              </span>
            )}
            {aberta && (
              <button
                type="button"
                className="sessao-remover"
                onClick={() => handleRemover(p.id, p.especie, p.tratamento)}
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>

      {aberta && (
        <div className="sessao-acoes">
          <Link to={`/sessao/${id}/nova`} className="salvar sessao-acao-link">
            Nova planta
          </Link>
          {primeiraPlanta && (
            <Link
              to={`/sessao/${id}/revisar/${primeiraPlanta.id}`}
              className="sessao-acao-secundaria"
            >
              Revisar plantas (preencher diâmetro)
            </Link>
          )}
          <button
            type="button"
            className="sessao-finalizar"
            disabled={!podeFinalizar || finalizando}
            onClick={handleFinalizar}
          >
            {finalizando ? 'Finalizando...' : 'Finalizar sessão'}
          </button>
        </div>
      )}

      {erro && <p className="feedback error">{erro}</p>}

      <button type="button" className="sessao-voltar" onClick={() => navigate('/sessao')}>
        Voltar pra lista de sessões
      </button>

      {aberta && (
        <button type="button" className="sessao-remover-sessao" onClick={handleRemoverSessao}>
          Remover sessão
        </button>
      )}
    </div>
  )
}
