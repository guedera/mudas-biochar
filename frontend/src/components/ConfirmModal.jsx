import { useEffect, useRef } from 'react'

/** Modal de confirmação com dois botões. Usa o <dialog> nativo: o foco fica
 * preso dentro dele, o resto da tela fica inerte e o ESC cancela. O foco abre
 * no "cancelar" (primeiro botão), então um Enter distraído não confirma nada. */
export default function ConfirmModal({
  aberto,
  titulo,
  children,
  textoConfirmar = 'Tenho certeza',
  textoCancelar = 'Cancelar',
  textoOcupado = 'Aguarde...',
  ocupado = false,
  onConfirmar,
  onCancelar,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (aberto && !dialog.open) dialog.showModal()
    if (!aberto && dialog.open) dialog.close()
  }, [aberto])

  function cancelar() {
    if (!ocupado) onCancelar()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="modal-titulo"
      onCancel={(event) => {
        // o ESC passa pelo estado do React em vez de fechar o <dialog> por conta própria
        event.preventDefault()
        cancelar()
      }}
      // clicar no fundo escurecido (o alvo é o próprio <dialog>) também cancela
      onClick={(event) => {
        if (event.target === dialogRef.current) cancelar()
      }}
    >
      <div className="modal-conteudo">
        <h2 id="modal-titulo">{titulo}</h2>
        <div className="modal-corpo">{children}</div>
        <div className="modal-acoes">
          <button type="button" className="modal-cancelar" onClick={cancelar} disabled={ocupado}>
            {textoCancelar}
          </button>
          <button type="button" className="modal-confirmar" onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? textoOcupado : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  )
}
