import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessao, updateSessaoPlanta } from '../api'
import { ESPECIES, TRATAMENTOS, INJURIAS } from '../constants'
import ToggleButton from '../components/ToggleButton'
import DecimalInput from '../components/DecimalInput'
import SessaoStatusBar from '../components/SessaoStatusBar'

function formToPayload(form) {
  return {
    especie: form.especie,
    tratamento: form.tratamento,
    altura: form.altura,
    diametro1: form.diametro1,
    diametro2: form.diametro2,
    tem_folhas: form.temFolhas,
    viva: form.viva,
    tem_daninha: form.temDaninha,
    injurias: form.injurias,
    observacao: form.observacao.trim() === '' ? null : form.observacao,
  }
}

function plantaToForm(planta) {
  return {
    especie: planta.especie,
    tratamento: planta.tratamento,
    altura: planta.altura,
    diametro1: planta.diametro1,
    diametro2: planta.diametro2,
    temFolhas: planta.tem_folhas,
    viva: planta.viva,
    temDaninha: planta.tem_daninha,
    injurias: planta.injurias,
    observacao: planta.observacao ?? '',
  }
}

export default function SessaoRevisar() {
  const { id, plantaId } = useParams()
  const navigate = useNavigate()
  const [sessao, setSessao] = useState(null)
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState({ state: 'idle' })

  useEffect(() => {
    getSessao(id)
      .then((s) => {
        setSessao(s)
        const planta = s.plantas.find((p) => p.id === Number(plantaId))
        setForm(planta ? plantaToForm(planta) : null)
        setStatus(planta ? { state: 'idle' } : { state: 'error', message: 'Planta não encontrada.' })
      })
      .catch(() => setStatus({ state: 'error', message: 'Sessão não encontrada.' }))
  }, [id, plantaId])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleInjuria(codigo) {
    setForm((prev) => ({
      ...prev,
      injurias: prev.injurias.includes(codigo)
        ? prev.injurias.filter((i) => i !== codigo)
        : [...prev.injurias, codigo],
    }))
  }

  async function salvar() {
    setStatus({ state: 'saving' })
    try {
      await updateSessaoPlanta(id, plantaId, formToPayload(form))
      return true
    } catch (err) {
      setStatus({ state: 'error', message: err.message })
      return false
    }
  }

  async function handleSalvarEProxima(event) {
    event.preventDefault()
    if (!(await salvar())) return

    const indiceAtual = sessao.plantas.findIndex((p) => p.id === Number(plantaId))
    const proxima = sessao.plantas[indiceAtual + 1]
    navigate(proxima ? `/sessao/${id}/revisar/${proxima.id}` : `/sessao/${id}`)
  }

  async function handleSalvarEVoltar(event) {
    event.preventDefault()
    if (!(await salvar())) return
    navigate(`/sessao/${id}`)
  }

  if (!sessao || !form) {
    return status.state === 'error' ? (
      <p className="feedback error">{status.message}</p>
    ) : (
      <p>Carregando...</p>
    )
  }

  const indiceAtual = sessao.plantas.findIndex((p) => p.id === Number(plantaId))

  return (
    <form className="cadastro-form" onSubmit={handleSalvarEProxima}>
      <SessaoStatusBar sessao={sessao} />
      <p className="data-medicao">
        Revisando planta {indiceAtual + 1} de {sessao.plantas.length}
      </p>

      <div className="field-grid">
        <label>
          Espécie
          <select value={form.especie} onChange={(e) => setField('especie', e.target.value)} required>
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
            value={form.tratamento}
            onChange={(e) => setField('tratamento', e.target.value)}
            required
          >
            {TRATAMENTOS.map((tratamento) => (
              <option key={tratamento} value={tratamento}>
                {tratamento}
              </option>
            ))}
          </select>
        </label>

        <label>
          Altura (cm)
          <DecimalInput casas={1} valor={form.altura} onChange={(v) => setField('altura', v)} />
        </label>

        <label>
          Diâmetro 1 (mm)
          <DecimalInput
            casas={2}
            valor={form.diametro1}
            onChange={(v) => setField('diametro1', v)}
          />
        </label>

        <label>
          Diâmetro 2 (mm)
          <DecimalInput
            casas={2}
            valor={form.diametro2}
            onChange={(v) => setField('diametro2', v)}
          />
        </label>
      </div>

      <div className="toggles">
        <ToggleButton
          value={form.temFolhas}
          onChange={(v) => setField('temFolhas', v)}
          labelTrue="Tem folhas"
          labelFalse="Sem folhas"
        />
        <ToggleButton
          value={form.viva}
          onChange={(v) => setField('viva', v)}
          labelTrue="Viva"
          labelFalse="Morta"
        />
        <ToggleButton
          value={form.temDaninha}
          onChange={(v) => setField('temDaninha', v)}
          labelTrue="Tem daninha"
          labelFalse="Sem daninha"
        />
      </div>

      <fieldset className="injurias">
        <legend>Injúria (opcional, pode marcar mais de uma)</legend>
        {INJURIAS.map((codigo) => (
          <label key={codigo} className="chip">
            <input
              type="checkbox"
              checked={form.injurias.includes(codigo)}
              onChange={() => toggleInjuria(codigo)}
            />
            {codigo}
          </label>
        ))}
      </fieldset>

      <label>
        Observação
        <textarea
          value={form.observacao}
          onChange={(e) => setField('observacao', e.target.value)}
          rows={3}
        />
      </label>

      <button type="submit" className="salvar" disabled={status.state === 'saving'}>
        {status.state === 'saving' ? 'Salvando...' : 'Salvar e próxima'}
      </button>

      <button
        type="button"
        className="sessao-voltar"
        disabled={status.state === 'saving'}
        onClick={handleSalvarEVoltar}
      >
        Salvar e voltar pra sessão
      </button>

      {status.state === 'error' && <p className="feedback error">{status.message}</p>}
    </form>
  )
}
