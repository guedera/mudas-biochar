import { useState } from 'react'
import { createMedicao } from '../api'
import { ESPECIES, TRATAMENTOS, INJURIAS } from '../constants'
import ToggleButton from '../components/ToggleButton'

const initialForm = {
  bloco: '',
  especie: '',
  tratamento: '',
  altura: '',
  diametro1: '',
  diametro2: '',
  temFolhas: true,
  viva: true,
  temDaninha: false,
  injurias: [],
  observacao: '',
}

function parseOptionalFloat(value) {
  if (value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isNaN(parsed) ? null : parsed
}

function validar(form) {
  if (form.bloco.trim() === '' || Number.isNaN(Number(form.bloco))) {
    return 'Informe o número do bloco.'
  }
  if (!form.especie) return 'Selecione a espécie.'
  if (!form.tratamento) return 'Selecione o tratamento.'
  return null
}

export default function Cadastro() {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ state: 'idle' })

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
      await createMedicao({
        bloco: Number(form.bloco),
        especie: form.especie,
        tratamento: form.tratamento,
        altura: parseOptionalFloat(form.altura),
        diametro1: parseOptionalFloat(form.diametro1),
        diametro2: parseOptionalFloat(form.diametro2),
        tem_folhas: form.temFolhas,
        viva: form.viva,
        tem_daninha: form.temDaninha,
        injurias: form.injurias,
        observacao: form.observacao.trim() === '' ? null : form.observacao,
      })
      setForm(initialForm)
      setStatus({ state: 'success' })
    } catch (err) {
      setStatus({ state: 'error', message: err.message })
    }
  }

  return (
    <form className="cadastro-form" onSubmit={handleSubmit}>
      <p className="data-medicao">
        Data da medição: <strong>{new Date().toLocaleString('pt-BR')}</strong>{' '}
        (preenchida automaticamente ao salvar)
      </p>

      <div className="field-grid">
        <label>
          Bloco
          <input
            type="number"
            inputMode="numeric"
            value={form.bloco}
            onChange={(e) => setField('bloco', e.target.value)}
            required
          />
        </label>

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
          <input
            type="text"
            inputMode="decimal"
            placeholder="NA"
            value={form.altura}
            onChange={(e) => setField('altura', e.target.value)}
          />
        </label>

        <label>
          Diâmetro 1 (mm)
          <input
            type="text"
            inputMode="decimal"
            placeholder="NA"
            value={form.diametro1}
            onChange={(e) => setField('diametro1', e.target.value)}
          />
        </label>

        <label>
          Diâmetro 2 (mm)
          <input
            type="text"
            inputMode="decimal"
            placeholder="NA"
            value={form.diametro2}
            onChange={(e) => setField('diametro2', e.target.value)}
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
        {status.state === 'saving' ? 'Salvando...' : 'Salvar medição'}
      </button>

      {status.state === 'success' && (
        <p className="feedback success">Medição salva com sucesso.</p>
      )}
      {status.state === 'error' && <p className="feedback error">{status.message}</p>}
    </form>
  )
}
