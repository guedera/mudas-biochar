import { useEffect, useRef, useState } from 'react'
import { deleteMedicao, getBlocos, getMedicoesTabela } from '../api'
import { ESPECIES, TRATAMENTOS } from '../constants'
import ConfirmModal from '../components/ConfirmModal'

const FILTROS_VAZIOS = { bloco: '', especie: '', tratamento: '' }
const SEM_VALOR = '—'

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

function IconeLixeira() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export default function Tabela() {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(1)
  const [recarga, setRecarga] = useState(0)
  const [dados, setDados] = useState(null)
  const [blocos, setBlocos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [paraExcluir, setParaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const tabelaRef = useRef(null)

  const filtrosAtivos = Object.values(filtros).some(Boolean)

  // a lista de blocos muda quando uma exclusão leva embora o último registro de um deles
  useEffect(() => {
    getBlocos()
      .then(setBlocos)
      .catch(() => setBlocos([]))
  }, [recarga])

  useEffect(() => {
    // `atual` descarta a resposta de uma consulta que já não vale (filtro trocado no meio)
    let atual = true
    setCarregando(true)
    getMedicoesTabela(filtros, pagina)
      .then((resposta) => {
        if (!atual) return
        if (resposta.itens.length === 0 && pagina > 1) {
          // excluiu a última medição de uma página que não é a primeira: volta uma
          setPagina(pagina - 1)
          return
        }
        setDados(resposta)
        setErro(null)
        setCarregando(false)
      })
      .catch((err) => {
        if (!atual) return
        setErro(err.message)
        setCarregando(false)
      })
    return () => {
      atual = false
    }
  }, [filtros, pagina, recarga])

  function mudarFiltro(campo, valor) {
    setFiltros((anteriores) => ({ ...anteriores, [campo]: valor }))
    setPagina(1)
    setAviso(null)
  }

  function irParaPagina(numero) {
    setPagina(numero)
    tabelaRef.current?.scrollIntoView({ block: 'start' })
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    try {
      await deleteMedicao(paraExcluir.id)
      setAviso({ tipo: 'success', mensagem: 'Medição excluída.' })
    } catch (err) {
      setAviso({ tipo: 'error', mensagem: err.message })
    } finally {
      setExcluindo(false)
      setParaExcluir(null)
      setRecarga((n) => n + 1)
    }
  }

  return (
    <div className="tabela-pagina">
      <section className="relatorio-secao" ref={tabelaRef}>
        <h2>Tabela de medições</h2>
        <p className="secao-descricao">
          Todas as medições do banco definitivo, das mais recentes para as mais antigas. Use os
          filtros pra achar uma medição específica; a lixeira exclui a medição (com confirmação) e
          não tem volta.
        </p>

        <div className="tabela-filtros">
          <label>
            Bloco
            <select value={filtros.bloco} onChange={(e) => mudarFiltro('bloco', e.target.value)}>
              <option value="">Todos</option>
              {blocos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label>
            Espécie
            <select value={filtros.especie} onChange={(e) => mudarFiltro('especie', e.target.value)}>
              <option value="">Todas</option>
              {ESPECIES.map((especie) => (
                <option key={especie} value={especie}>
                  {especie}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tratamento
            <select
              value={filtros.tratamento}
              onChange={(e) => mudarFiltro('tratamento', e.target.value)}
            >
              <option value="">Todos</option>
              {TRATAMENTOS.map((tratamento) => (
                <option key={tratamento} value={tratamento}>
                  {tratamento}
                </option>
              ))}
            </select>
          </label>

          {filtrosAtivos && (
            <button
              type="button"
              className="tabela-botao"
              onClick={() => {
                setFiltros(FILTROS_VAZIOS)
                setPagina(1)
                setAviso(null)
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {aviso && <p className={`feedback ${aviso.tipo}`}>{aviso.mensagem}</p>}
        {erro && <p className="feedback error">{erro}</p>}
      </section>

      {dados === null ? (
        !erro && <p>Carregando...</p>
      ) : (
        <>
          <p className="tabela-resumo">
            {dados.total === 0
              ? 'Nenhuma medição encontrada'
              : `${dados.total} ${dados.total === 1 ? 'medição' : 'medições'}`}
            {filtrosAtivos && dados.total > 0 ? ' com esses filtros' : ''}
            {dados.total > 0 && ` · página ${dados.pagina} de ${dados.total_paginas}`}
          </p>

          {dados.itens.length > 0 && (
            <div className={`tabela-rolagem ${carregando ? 'is-carregando' : ''}`}>
              <table className="tabela-dados">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Bloco</th>
                    <th>Espécie</th>
                    <th>Trat.</th>
                    <th>Altura (cm)</th>
                    <th>Diâm. 1 (mm)</th>
                    <th>Diâm. 2 (mm)</th>
                    <th>Folhas</th>
                    <th>Sobrev.</th>
                    <th>Daninha</th>
                    <th>Injúria</th>
                    <th>Observação</th>
                    <th>
                      <span className="sr-only">Excluir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.itens.map((m) => (
                    <tr key={m.id}>
                      <td>{formatarDataHora(m.data_medicao)}</td>
                      <td>{m.bloco}</td>
                      <td>{m.especie}</td>
                      <td>{m.tratamento}</td>
                      <td>{m.altura ?? SEM_VALOR}</td>
                      <td>{m.diametro1 ?? SEM_VALOR}</td>
                      <td>{m.diametro2 ?? SEM_VALOR}</td>
                      <td>{m.tem_folhas ? 'Sim' : 'Não'}</td>
                      <td className={m.viva ? undefined : 'tabela-morta'}>
                        {m.viva ? 'Viva' : 'Morta'}
                      </td>
                      <td>{m.tem_daninha ? 'Sim' : 'Não'}</td>
                      <td>{m.injurias.length > 0 ? m.injurias.join(', ') : SEM_VALOR}</td>
                      <td className="tabela-obs" title={m.observacao ?? undefined}>
                        {m.observacao ?? SEM_VALOR}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="tabela-lixeira"
                          aria-label={`Excluir a medição do bloco ${m.bloco}, ${m.especie}, ${m.tratamento}, de ${formatarDataHora(m.data_medicao)}`}
                          title="Excluir medição"
                          onClick={() => setParaExcluir(m)}
                        >
                          <IconeLixeira />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dados.total_paginas > 1 && (
            <div className="tabela-paginacao">
              <button
                type="button"
                className="tabela-botao"
                disabled={pagina <= 1}
                onClick={() => irParaPagina(pagina - 1)}
              >
                Anterior
              </button>
              <span>
                Página {dados.pagina} de {dados.total_paginas}
              </span>
              <button
                type="button"
                className="tabela-botao"
                disabled={pagina >= dados.total_paginas}
                onClick={() => irParaPagina(pagina + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        aberto={paraExcluir !== null}
        titulo="Excluir esta medição?"
        textoConfirmar="Tenho certeza"
        textoCancelar="Cancelar"
        textoOcupado="Excluindo..."
        ocupado={excluindo}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setParaExcluir(null)}
      >
        {paraExcluir && (
          <>
            <p>
              <strong>
                Bloco {paraExcluir.bloco} · {paraExcluir.especie} · {paraExcluir.tratamento}
              </strong>
              <br />
              medida em {formatarDataHora(paraExcluir.data_medicao)}
            </p>
            <p>Essa ação não pode ser desfeita.</p>
          </>
        )}
      </ConfirmModal>
    </div>
  )
}
