from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import Especie, Tratamento
from app.models import Medicao
from app.schemas import MedicaoCreate, MedicaoRead

router = APIRouter(prefix="/medicoes", tags=["medicoes"])


@router.post("", response_model=MedicaoRead, status_code=201)
def create_medicao(payload: MedicaoCreate, db: Session = Depends(get_db)) -> Medicao:
    medicao = Medicao(**payload.model_dump())
    db.add(medicao)
    db.commit()
    db.refresh(medicao)
    return medicao


@router.get("", response_model=list[MedicaoRead])
def list_medicoes(
    bloco: int | None = None,
    especie: Especie | None = None,
    tratamento: Tratamento | None = None,
    db: Session = Depends(get_db),
) -> list[Medicao]:
    """Lista medições, mais recentes primeiro.

    Filtrar por bloco+especie+tratamento retorna o histórico de uma planta
    específica ao longo do tempo.
    """
    query = db.query(Medicao)
    if bloco is not None:
        query = query.filter(Medicao.bloco == bloco)
    if especie is not None:
        query = query.filter(Medicao.especie == especie.value)
    if tratamento is not None:
        query = query.filter(Medicao.tratamento == tratamento.value)
    return query.order_by(Medicao.data_medicao.desc()).all()
