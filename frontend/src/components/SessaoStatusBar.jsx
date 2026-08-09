export default function SessaoStatusBar({ sessao }) {
  if (!sessao) return null

  const completa = sessao.total_plantas > 0 && sessao.total_completas === sessao.total_plantas

  return (
    <div className="sessao-status-bar">
      <span className="sessao-status-bloco">Bloco {sessao.bloco}</span>
      <span className={`sessao-status-progresso ${completa ? 'is-completa' : ''}`}>
        {sessao.total_completas}/{sessao.total_plantas} plantas completas
      </span>
      {sessao.finalizada_em && <span className="sessao-status-badge">Finalizada</span>}
    </div>
  )
}
