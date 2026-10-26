import io
import math
from datetime import date, datetime, timedelta

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Query, Session

from app.database import get_db
from app.enums import Especie, Injuria, Tratamento
from app.models import Medicao
from app.schemas import MedicaoCreate, MedicaoRead, PaginaMedicoes

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


def _filtrar_planta(
    query: Query, bloco: int | None, especie: Especie | None, tratamento: Tratamento | None
) -> Query:
    """Filtros por bloco, espécie e tratamento (valor único, todos opcionais)."""
    query = _filtrar_estrutural(
        query, bloco=bloco, tem_folhas=None, viva=None, tem_daninha=None
    )
    if especie is not None:
        query = query.filter(Medicao.especie == especie.value)
    if tratamento is not None:
        query = query.filter(Medicao.tratamento == tratamento.value)
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
    query = _filtrar_planta(db.query(Medicao), bloco, especie, tratamento)
    return query.order_by(Medicao.data_medicao.desc()).all()


@router.get("/tabela", response_model=PaginaMedicoes)
def tabela_medicoes(
    bloco: int | None = None,
    especie: Especie | None = None,
    tratamento: Tratamento | None = None,
    pagina: int = QueryParam(1, ge=1),
    por_pagina: int = QueryParam(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> PaginaMedicoes:
    """Uma página da tabela de medições (mais recentes primeiro), com filtros
    opcionais por bloco, espécie e tratamento. `total` é a contagem com os
    filtros aplicados, pra a tela montar a paginação."""
    query = _filtrar_planta(db.query(Medicao), bloco, especie, tratamento)
    total = query.count()
    itens = (
        query.order_by(Medicao.data_medicao.desc(), Medicao.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return PaginaMedicoes(
        itens=itens,
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        total_paginas=max(1, math.ceil(total / por_pagina)),
    )


@router.delete("/{medicao_id}", status_code=204)
def delete_medicao(medicao_id: int, db: Session = Depends(get_db)) -> None:
    """Exclui uma medição definitiva. Não tem volta: as plantas das sessões
    já finalizadas são um histórico à parte e não são afetadas."""
    medicao = db.get(Medicao, medicao_id)
    if medicao is None:
        raise HTTPException(status_code=404, detail="Medição não encontrada.")
    db.delete(medicao)
    db.commit()


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
    data: date | None = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Exporta medições filtradas em CSV. Todos os filtros são opcionais —
    sem nenhum, exporta a base inteira. Bloco, espécie e tratamento aceitam
    mais de um valor (ex. `?tratamentos=T1&tratamentos=T2`); se `injurias`
    e/ou `sem_injuria=true` forem informados, uma medição entra se tiver
    pelo menos uma das injúrias marcadas OU (se `sem_injuria=true`) não
    tiver nenhuma — ou seja, dá pra combinar "AA" com "sem nenhuma". `data`
    filtra pelo dia de `data_medicao` (armazenada em UTC)."""
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
    if data is not None:
        inicio = datetime.combine(data, datetime.min.time())
        fim = inicio + timedelta(days=1)
        query = query.filter(Medicao.data_medicao >= inicio, Medicao.data_medicao < fim)

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

    # BOM UTF-8 na frente: sem ele, o Excel abre o CSV assumindo Latin-1 e
    # todo acento (ç, ã, é...) vem corrompido.
    conteudo = chr(0xFEFF) + buffer.getvalue()

    return StreamingResponse(
        iter([conteudo]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medicoes.csv"},
    )
