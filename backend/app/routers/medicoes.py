import io

import pandas as pd
from fastapi import APIRouter, Depends, Query as QueryParam
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Query, Session

from app.database import get_db
from app.enums import Especie, Injuria, Tratamento
from app.models import Medicao
from app.schemas import MedicaoCreate, MedicaoRead

router = APIRouter(prefix="/medicoes", tags=["medicoes"])

COLUNAS_EXPORT = {
    "bloco": "Bloco",
    "especie": "Espécie",
    "tratamento": "Tratamento",
    "altura": "Altura (cm)",
    "diametro1": "Diâmetro 1 (mm)",
    "diametro2": "Diâmetro 2 (mm)",
    "tem_folhas": "Folhas",
    "viva": "Sobrevivência",
    "tem_daninha": "Daninha",
    "injurias": "Injúria",
    "observacao": "Observação",
    "data_medicao": "Data da medição",
}


def _filtrar_estrutural(
    query: Query,
    tem_folhas: bool | None,
    viva: bool | None,
    tem_daninha: bool | None,
    bloco: int | None = None,
) -> Query:
    """Filtros que dá pra expressar direto numa query SQL (tudo, exceto
    bloco/espécie/tratamento no export — que aceitam múltiplos valores — e
    injúria, que depende do conteúdo da coluna JSON)."""
    if bloco is not None:
        query = query.filter(Medicao.bloco == bloco)
    if tem_folhas is not None:
        query = query.filter(Medicao.tem_folhas == tem_folhas)
    if viva is not None:
        query = query.filter(Medicao.viva == viva)
    if tem_daninha is not None:
        query = query.filter(Medicao.tem_daninha == tem_daninha)
    return query


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
    query = _filtrar_estrutural(
        db.query(Medicao),
        bloco=bloco,
        tem_folhas=None,
        viva=None,
        tem_daninha=None,
    )
    if especie is not None:
        query = query.filter(Medicao.especie == especie.value)
    if tratamento is not None:
        query = query.filter(Medicao.tratamento == tratamento.value)
    return query.order_by(Medicao.data_medicao.desc()).all()


@router.get("/blocos", response_model=list[int])
def list_blocos(db: Session = Depends(get_db)) -> list[int]:
    """Números de bloco distintos já cadastrados, pra popular o filtro de
    blocos do relatório."""
    resultado = db.query(Medicao.bloco).distinct().order_by(Medicao.bloco).all()
    return [bloco for (bloco,) in resultado]


@router.get("/export")
def export_medicoes(
    blocos: list[int] | None = QueryParam(None),
    especies: list[Especie] | None = QueryParam(None),
    tratamentos: list[Tratamento] | None = QueryParam(None),
    tem_folhas: bool | None = None,
    viva: bool | None = None,
    tem_daninha: bool | None = None,
    injurias: list[Injuria] | None = QueryParam(None),
    sem_injuria: bool = False,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Exporta medições filtradas em CSV. Todos os filtros são opcionais —
    sem nenhum, exporta a base inteira. Bloco, espécie e tratamento aceitam
    mais de um valor (ex. `?tratamentos=T1&tratamentos=T2`); se `injurias`
    e/ou `sem_injuria=true` forem informados, uma medição entra se tiver
    pelo menos uma das injúrias marcadas OU (se `sem_injuria=true`) não
    tiver nenhuma — ou seja, dá pra combinar "AA" com "sem nenhuma"."""
    query = _filtrar_estrutural(
        db.query(Medicao),
        tem_folhas=tem_folhas,
        viva=viva,
        tem_daninha=tem_daninha,
    )
    if blocos:
        query = query.filter(Medicao.bloco.in_(blocos))
    if especies:
        query = query.filter(Medicao.especie.in_([e.value for e in especies]))
    if tratamentos:
        query = query.filter(Medicao.tratamento.in_([t.value for t in tratamentos]))

    medicoes = query.order_by(Medicao.data_medicao.desc()).all()

    if injurias or sem_injuria:
        codigos_injuria = {i.value for i in injurias} if injurias else set()
        medicoes = [
            m
            for m in medicoes
            if (sem_injuria and not m.injurias) or (codigos_injuria & set(m.injurias))
        ]

    linhas = [
        {
            "bloco": m.bloco,
            "especie": m.especie,
            "tratamento": m.tratamento,
            "altura": m.altura,
            "diametro1": m.diametro1,
            "diametro2": m.diametro2,
            "tem_folhas": int(m.tem_folhas),
            "viva": int(m.viva),
            "tem_daninha": int(m.tem_daninha),
            "injurias": ",".join(m.injurias),
            "observacao": m.observacao,
            "data_medicao": m.data_medicao.strftime("%d/%m/%Y %H:%M:%S"),
        }
        for m in medicoes
    ]

    df = pd.DataFrame(linhas, columns=list(COLUNAS_EXPORT.keys()))
    df = df.rename(columns=COLUNAS_EXPORT)

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medicoes.csv"},
    )
