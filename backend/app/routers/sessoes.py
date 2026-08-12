from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Medicao, Sessao, SessaoPlanta, _now_utc
from app.schemas import (
    SessaoCreate,
    SessaoDetalhe,
    SessaoPlantaCreate,
    SessaoPlantaRead,
    SessaoPlantaUpdate,
    SessaoRead,
)

router = APIRouter(prefix="/sessoes", tags=["sessoes"])


def _get_sessao(sessao_id: int, db: Session) -> Sessao:
    sessao = db.get(Sessao, sessao_id)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    return sessao


def _get_planta(sessao: Sessao, planta_id: int) -> SessaoPlanta:
    for planta in sessao.plantas:
        if planta.id == planta_id:
            return planta
    raise HTTPException(status_code=404, detail="Planta não encontrada nesta sessão.")


@router.post("", response_model=SessaoRead, status_code=201)
def create_sessao(payload: SessaoCreate, db: Session = Depends(get_db)) -> Sessao:
    aberta = (
        db.query(Sessao)
        .filter(Sessao.bloco == payload.bloco, Sessao.finalizada_em.is_(None))
        .first()
    )
    if aberta is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "Já existe uma sessão aberta para este bloco.",
                "sessao_id": aberta.id,
            },
        )
    sessao = Sessao(bloco=payload.bloco)
    db.add(sessao)
    db.commit()
    db.refresh(sessao)
    return sessao


@router.get("", response_model=list[SessaoRead])
def list_sessoes(db: Session = Depends(get_db)) -> list[Sessao]:
    return db.query(Sessao).order_by(Sessao.criada_em.desc()).all()


@router.get("/{sessao_id}", response_model=SessaoDetalhe)
def get_sessao(sessao_id: int, db: Session = Depends(get_db)) -> Sessao:
    return _get_sessao(sessao_id, db)


@router.delete("/{sessao_id}", status_code=204)
def delete_sessao(sessao_id: int, db: Session = Depends(get_db)) -> None:
    """Remove uma sessão inteira (e suas plantas, em cascata). Só permitido
    enquanto a sessão está aberta — uma sessão finalizada já gerou medições
    definitivas e vira histórico, não pode mais ser descartada."""
    sessao = _get_sessao(sessao_id, db)
    if sessao.finalizada_em is not None:
        raise HTTPException(status_code=409, detail="Sessão já finalizada não pode ser removida.")
    db.delete(sessao)
    db.commit()


@router.post("/{sessao_id}/plantas", response_model=SessaoPlantaRead, status_code=201)
def add_planta(
    sessao_id: int, payload: SessaoPlantaCreate, db: Session = Depends(get_db)
) -> SessaoPlanta:
    """Lança uma planta na sessão. Altura e diâmetro já podem ser
    preenchidos de cara, mas são opcionais: dá pra salvar incompleta e
    completar depois na revisão."""
    sessao = _get_sessao(sessao_id, db)
    if sessao.finalizada_em is not None:
        raise HTTPException(status_code=409, detail="Sessão já finalizada.")

    duplicada = any(
        p.especie == payload.especie.value and p.tratamento == payload.tratamento.value
        for p in sessao.plantas
    )
    if duplicada:
        raise HTTPException(
            status_code=409,
            detail="Já existe uma planta com essa espécie e tratamento nesta sessão.",
        )

    planta = SessaoPlanta(sessao_id=sessao.id, **payload.model_dump())
    if planta.diametro1 is not None:
        planta.diametro_preenchido_em = _now_utc()
    db.add(planta)
    db.commit()
    db.refresh(planta)
    return planta


@router.patch("/{sessao_id}/plantas/{planta_id}", response_model=SessaoPlantaRead)
def update_planta(
    sessao_id: int,
    planta_id: int,
    payload: SessaoPlantaUpdate,
    db: Session = Depends(get_db),
) -> SessaoPlanta:
    """Edita uma planta da sessão (fase 2: abre diâmetro, mas aceita corrigir
    qualquer campo lançado na fase 1)."""
    sessao = _get_sessao(sessao_id, db)
    if sessao.finalizada_em is not None:
        raise HTTPException(status_code=409, detail="Sessão já finalizada.")
    planta = _get_planta(sessao, planta_id)

    dados = payload.model_dump(exclude_unset=True)
    if dados.get("diametro1") is not None and planta.diametro_preenchido_em is None:
        planta.diametro_preenchido_em = _now_utc()
    for campo, valor in dados.items():
        setattr(planta, campo, valor)

    db.commit()
    db.refresh(planta)
    return planta


@router.delete("/{sessao_id}/plantas/{planta_id}", status_code=204)
def delete_planta(sessao_id: int, planta_id: int, db: Session = Depends(get_db)) -> None:
    """Remove uma planta lançada por engano na sessão."""
    sessao = _get_sessao(sessao_id, db)
    if sessao.finalizada_em is not None:
        raise HTTPException(status_code=409, detail="Sessão já finalizada.")
    planta = _get_planta(sessao, planta_id)
    db.delete(planta)
    db.commit()


@router.post("/{sessao_id}/finalizar", response_model=SessaoRead)
def finalizar_sessao(sessao_id: int, db: Session = Depends(get_db)) -> Sessao:
    """Envia todas as plantas da sessão pro banco definitivo de medições.

    Só permitido quando toda planta da sessão está completa (altura e
    diâmetro preenchidos). `data_medicao` de cada `Medicao` criada é a hora
    em que a planta foi lançada na fase 1 (`criada_em`), não a hora da
    finalização.
    """
    sessao = _get_sessao(sessao_id, db)
    if sessao.finalizada_em is not None:
        raise HTTPException(status_code=409, detail="Sessão já finalizada.")
    if not sessao.plantas:
        raise HTTPException(status_code=400, detail="Sessão não tem nenhuma planta lançada.")
    incompletas = [p for p in sessao.plantas if not p.completa]
    if incompletas:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{len(incompletas)} planta(s) ainda sem altura e/ou diâmetro preenchidos."
            ),
        )

    for planta in sessao.plantas:
        db.add(
            Medicao(
                bloco=sessao.bloco,
                especie=planta.especie,
                tratamento=planta.tratamento,
                altura=planta.altura,
                diametro1=planta.diametro1,
                diametro2=planta.diametro2,
                tem_folhas=planta.tem_folhas,
                viva=planta.viva,
                tem_daninha=planta.tem_daninha,
                injurias=list(planta.injurias),
                observacao=planta.observacao,
                data_medicao=planta.criada_em,
            )
        )
    sessao.finalizada_em = _now_utc()
    db.commit()
    db.refresh(sessao)
    return sessao
