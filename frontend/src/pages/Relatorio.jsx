import { useEffect, useState } from 'react'
import { ESPECIES, INJURIAS, TRATAMENTOS } from '../constants'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const SEM_INJURIA = 'Sem nenhuma injúria'
const INJURIA_OPCOES = [...INJURIAS, SEM_INJURIA]

const initialFiltros = {
  blocos: [],
  tratamentos: [],
  especies: [],
  injurias: [],
  folhas: 'todos',
  sobrevivencia: 'todos',
  daninha: 'todos',
}

function buildParams(filtros) {
  const params = new URLSearchParams()

  filtros.blocos.forEach((bloco) => params.append('blocos', bloco))
  filtros.tratamentos.forEach((tratamento) => params.append('tratamentos', tratamento))
  filtros.especies.forEach((especie) => params.append('especies', especie))

  filtros.injurias
    .filter((injuria) => injuria !== SEM_INJURIA)
    .forEach((injuria) => params.append('injurias', injuria))
  if (filtros.injurias.includes(SEM_INJURIA)) params.set('sem_injuria', 'true')

  if (filtros.folhas !== 'todos') params.set('tem_folhas', filtros.folhas === 'com')
  if (filtros.sobrevivencia !== 'todos') params.set('viva', filtros.sobrevivencia === 'viva')
  if (filtros.daninha !== 'todos') params.set('tem_daninha', filtros.daninha === 'com')

  return params
}

function baixarArquivo(url) {
  const link = document.createElement('a')
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function validarFiltros(filtros) {
  const faltando = []
  if (filtros.blocos.length === 0) faltando.push('Bloco')
  if (filtros.tratamentos.length === 0) faltando.push('Tratamento')
  if (filtros.especies.length === 0) faltando.push('Espécie')
  if (filtros.injurias.length === 0) faltando.push('Injúria')
  if (faltando.length === 0) return null
  return `Marque pelo menos uma opção em: ${faltando.join(', ')} (use "Marcar todos" pra incluir todos).`
}

function GrupoFiltro({ titulo, opcoes, selecionados, onToggle, onMarcarTodos, onDesmarcarTodos }) {
  return (
    <fieldset className="injurias">
      <legend>{titulo} (marque pelo menos um; "Marcar todos" inclui todos)</legend>
      <div className="grupo-acoes">
        <button type="button" className="marcar-todos" onClick={onMarcarTodos}>
          Marcar todos
        </button>
        <button type="button" className="marcar-todos" onClick={onDesmarcarTodos}>
          Desmarcar todos
        </button>
      </div>
      {opcoes.map((opcao) => (
        <label key={opcao} className="chip">
          <input
            type="checkbox"
            checked={selecionados.includes(opcao)}
            onChange={() => onToggle(opcao)}
          />
          {opcao}
        </label>
      ))}
    </fieldset>
  )
}

export default function Relatorio() {
  const [filtros, setFiltros] = useState(initialFiltros)
  const [blocosDisponiveis, setBlocosDisponiveis] = useState([])
  const [erro, setErro] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/medicoes/blocos`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setBlocosDisponiveis)
      .catch(() => setBlocosDisponiveis([]))
  }, [])

  function setFiltro(campo, valor) {
    setFiltros((prev) => ({ ...prev, [campo]: valor }))
  }

  function toggleValor(campo, valor) {
    setFiltros((prev) => ({
      ...prev,
      [campo]: prev[campo].includes(valor)
        ? prev[campo].filter((v) => v !== valor)
        : [...prev[campo], valor],
    }))
  }

  function handleBaixarCsv(event) {
    event.preventDefault()
    const erroValidacao = validarFiltros(filtros)
    if (erroValidacao) {
      setErro(erroValidacao)
      return
    }
    setErro(null)
    const params = buildParams(filtros)
    baixarArquivo(`${API_URL}/medicoes/export?${params.toString()}`)
  }

  return (
    <div className="relatorio">
      <section className="relatorio-secao">
        <h2>Dados</h2>
        <p className="secao-descricao">
          Baixe as medições cadastradas em CSV. Bloco, Tratamento, Espécie e Injúria exigem
          marcar pelo menos uma opção cada (use "Marcar todos" pra incluir todos); Folhas,
          Sobrevivência e Daninha continuam opcionais.
        </p>

        <form className="filtros-form" onSubmit={handleBaixarCsv}>
          <GrupoFiltro
            titulo="Bloco"
            opcoes={blocosDisponiveis}
            selecionados={filtros.blocos}
            onToggle={(valor) => toggleValor('blocos', valor)}
            onMarcarTodos={() => setFiltro('blocos', blocosDisponiveis)}
            onDesmarcarTodos={() => setFiltro('blocos', [])}
          />

          <GrupoFiltro
            titulo="Tratamento"
            opcoes={TRATAMENTOS}
            selecionados={filtros.tratamentos}
            onToggle={(valor) => toggleValor('tratamentos', valor)}
            onMarcarTodos={() => setFiltro('tratamentos', TRATAMENTOS)}
            onDesmarcarTodos={() => setFiltro('tratamentos', [])}
          />

          <GrupoFiltro
            titulo="Espécie"
            opcoes={ESPECIES}
            selecionados={filtros.especies}
            onToggle={(valor) => toggleValor('especies', valor)}
            onMarcarTodos={() => setFiltro('especies', ESPECIES)}
            onDesmarcarTodos={() => setFiltro('especies', [])}
          />

          <GrupoFiltro
            titulo="Injúria"
            opcoes={INJURIA_OPCOES}
            selecionados={filtros.injurias}
            onToggle={(valor) => toggleValor('injurias', valor)}
            onMarcarTodos={() => setFiltro('injurias', INJURIA_OPCOES)}
            onDesmarcarTodos={() => setFiltro('injurias', [])}
          />

          <div className="field-grid">
            <label>
              Folhas
              <select
                value={filtros.folhas}
                onChange={(e) => setFiltro('folhas', e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="com">Com folhas</option>
                <option value="sem">Sem folhas</option>
              </select>
            </label>

            <label>
              Sobrevivência
              <select
                value={filtros.sobrevivencia}
                onChange={(e) => setFiltro('sobrevivencia', e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="viva">Viva</option>
                <option value="morta">Morta</option>
              </select>
            </label>

            <label>
              Daninha
              <select
                value={filtros.daninha}
                onChange={(e) => setFiltro('daninha', e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="com">Com daninha</option>
                <option value="sem">Sem daninha</option>
              </select>
            </label>
          </div>

          <button type="submit" className="salvar">
            Baixar CSV
          </button>
          {erro && <p className="feedback error">{erro}</p>}
        </form>
      </section>

      <section className="relatorio-secao">
        <h2>Diferenças</h2>
        <p className="secao-descricao">Em construção.</p>
      </section>
    </div>
  )
}
