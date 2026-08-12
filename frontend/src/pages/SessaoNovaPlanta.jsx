import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addSessaoPlanta, getSessao } from '../api'
import { ESPECIES, TRATAMENTOS, INJURIAS } from '../constants'
import ToggleButton from '../components/ToggleButton'
import DecimalInput from '../components/DecimalInput'
import SessaoStatusBar from '../components/SessaoStatusBar'

const initialForm = {
  especie: '',
  tratamento: '',
  altura: null,
  diametro1: null,
  diametro2: null,
  temFolhas: true,
  viva: true,
  temDaninha: false,
  injurias: [],
  observacao: '',
}

function validar(form) {
  if (!form.especie) return 'Selecione a espécie.'
  if (!form.tratamento) return 'Selecione o tratamento.'
  return null
}

export default function SessaoNovaPlanta() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sessao, setSessao] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ state: 'idle' })

  function recarregarSessao() {
    return getSessao(id).then(setSessao)
  }

  useEffect(() => {
    recarregarSessao().catch(() => setStatus({ state: 'error', message: 'Sessão não encontrada.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  async function handleSubmit(event) {
    event.preventDefault()

    const erro = validar(form)
    if (erro) {
      setStatus({ state: 'error', message: erro })
      return
    }

    setStatus({ state: 'saving' })
    try {
      await addSessaoPlanta(id, {
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
      })
      setForm(initialForm)
      setStatus({ state: 'success' })
      recarregarSessao()
    } catch (err) {
      setStatus({ state: 'error', message: err.message })
    }
  }

  if (!sessao) return <p>Carregando...</p>

  return (
    <form className="cadastro-form" onSubmit={handleSubmit}>
      <SessaoStatusBar sessao={sessao} />

      <div className="field-grid">
        <label>
          Espécie
          <select
            value={form.especie}
            onChange={(e) => setField('especie', e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione
            </option>
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
            <option value="" disabled>
              Selecione
            </option>
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
        {status.state === 'saving' ? 'Salvando...' : 'Salvar e próxima planta'}
      </button>

      <button type="button" className="sessao-voltar" onClick={() => navigate(`/sessao/${id}`)}>
        Voltar pra sessão
      </button>

      {status.state === 'success' && <p className="feedback success">Planta salva.</p>}
      {status.state === 'error' && <p className="feedback error">{status.message}</p>}
    </form>
  )
}
