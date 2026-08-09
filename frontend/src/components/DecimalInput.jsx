const MAX_DIGITOS = 6

function paraDigitos(valor, casas) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ''
  const inteiro = Math.round(Math.abs(valor) * 10 ** casas)
  return inteiro === 0 ? '' : String(inteiro)
}

function paraValor(digitos, casas) {
  if (digitos === '' || Number(digitos) === 0) return null
  return Number(digitos) / 10 ** casas
}

function formatarDigitos(digitos, casas) {
  if (digitos === '') return ''
  return (Number(digitos) / 10 ** casas).toFixed(casas)
}

/** Input numérico "estilo PIX": só aceita dígitos, que vão empurrando a
 * vírgula/ponto decimal da direita pra esquerda (ex. digitar 1,1,9 com
 * `casas=1` mostra 0.1 -> 1.1 -> 11.9). Evita erro de casas decimais na
 * digitação em campo, sem depender de o usuário acertar onde fica o ".". */
export default function DecimalInput({ casas, valor, onChange, placeholder = 'NA' }) {
  function handleChange(event) {
    const digitos = event.target.value.replace(/[^0-9]/g, '').slice(-MAX_DIGITOS)
    onChange(paraValor(digitos, casas))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={formatarDigitos(paraDigitos(valor, casas), casas)}
      onChange={handleChange}
    />
  )
}
