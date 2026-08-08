from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import Especie, Injuria, Tratamento
from app.models import Medicao
from app.schemas import (
    ContagemInjuria,
    DiametroPorTratamento,
    InjuriaVsSobrevivencia,
    MortalidadePorTratamento,
    PontoEvolucaoTratamento,
    ResumoDashboard,
)

# Sentinel maior que qualquer "YYYY-MM" real, pra representar "nunca morreu"
# nas comparações lexicográficas de período.
_NUNCA_MORREU = "9999-99"

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _medicoes_atuais(db: Session) -> list[Medicao]:
    """Estado atual de cada planta: sua medição mais recente.

    Uma planta (bloco+especie+tratamento) é medida várias vezes ao longo do
    tempo. Para qualquer estatística de "estado atual" (viva/morta, injúria,
    diâmetro), o que vale é a medição mais recente dela — mesmo que
    medições anteriores mostrem um estado diferente.
    """
    todas = db.query(Medicao).order_by(Medicao.data_medicao.desc()).all()
    vistos: set[tuple[int, str, str]] = set()
    atuais = []
    for medicao in todas:
        chave = (medicao.bloco, medicao.especie, medicao.tratamento)
        if chave in vistos:
            continue
        vistos.add(chave)
        atuais.append(medicao)
    return atuais


def _diametro_efetivo(medicao: Medicao) -> float | None:
    if medicao.diametro1 is None:
        return None
    if medicao.diametro2 is None:
        return medicao.diametro1
    return (medicao.diametro1 + medicao.diametro2) / 2


@router.get("/resumo", response_model=ResumoDashboard)
def resumo(db: Session = Depends(get_db)) -> ResumoDashboard:
    atuais = _medicoes_atuais(db)
    total = len(atuais)
    mortas = sum(1 for m in atuais if not m.viva)
    return ResumoDashboard(
        total_plantas=total,
        total_mortas=mortas,
        total_vivas=total - mortas,
        percentual_mortas=round(mortas / total * 100, 1) if total else 0.0,
    )


@router.get("/mortalidade-por-tratamento", response_model=list[MortalidadePorTratamento])
def mortalidade_por_tratamento(db: Session = Depends(get_db)) -> list[MortalidadePorTratamento]:
    """De todas as plantas mortas (pelo estado da medição mais recente de
    cada uma), qual o % de cada tratamento."""
    mortas = [m for m in _medicoes_atuais(db) if not m.viva]
    total = len(mortas)
    contagem = Counter(m.tratamento for m in mortas)
    return [
        MortalidadePorTratamento(
            tratamento=tratamento,
            mortas=contagem[tratamento.value],
            percentual=round(contagem[tratamento.value] / total * 100, 1) if total else 0.0,
        )
        for tratamento in Tratamento
        if contagem[tratamento.value] > 0
    ]


@router.get("/injurias", response_model=list[ContagemInjuria])
def injurias(db: Session = Depends(get_db)) -> list[ContagemInjuria]:
    """Contagem de cada tipo de injúria entre as plantas (estado atual)."""
    contagem = Counter(
        injuria for m in _medicoes_atuais(db) for injuria in m.injurias
    )
    resultado = [
        ContagemInjuria(injuria=injuria, contagem=contagem[injuria.value])
        for injuria in Injuria
        if contagem[injuria.value] > 0
    ]
    return sorted(resultado, key=lambda c: c.contagem, reverse=True)


@router.get("/diametro-por-tratamento", response_model=list[DiametroPorTratamento])
def diametro_por_tratamento(
    especie: Especie, db: Session = Depends(get_db)
) -> list[DiametroPorTratamento]:
    """Diâmetro médio (estado atual de cada planta) por tratamento, para
    uma espécie. Quando a planta tem Diâmetro 1 e 2 (caule quadrado), usa a
    média dos dois."""
    diametros: dict[str, list[float]] = {}
    for medicao in _medicoes_atuais(db):
        if medicao.especie != especie.value:
            continue
        valor = _diametro_efetivo(medicao)
        if valor is None:
            continue
        diametros.setdefault(medicao.tratamento, []).append(valor)

    resultado = [
        DiametroPorTratamento(
            tratamento=tratamento,
            diametro_medio=round(sum(valores) / len(valores), 2),
            n=len(valores),
        )
        for tratamento in Tratamento
        if (valores := diametros.get(tratamento.value))
    ]
    return resultado


def _periodo(medicao: Medicao) -> str:
    return medicao.data_medicao.strftime("%Y-%m")


@router.get("/evolucao", response_model=list[PontoEvolucaoTratamento])
def evolucao(db: Session = Depends(get_db)) -> list[PontoEvolucaoTratamento]:
    """Evolução mês a mês de cada tratamento, ao longo de todas as medições
    (não só a mais recente): altura média, diâmetro médio (das medições
    daquele mês) e % de mortalidade acumulada (planta conta como morta a
    partir do mês da primeira medição em que ela aparece morta — sobrevivência
    não "ressuscita", então esse % nunca cai)."""
    todas = db.query(Medicao).order_by(Medicao.data_medicao).all()
    if not todas:
        return []

    periodos = sorted({_periodo(m) for m in todas})
    plantas_do_tratamento: dict[str, set[tuple[int, str, str]]] = defaultdict(set)
    primeira_morte: dict[tuple[int, str, str], str] = {}
    medicoes_do_periodo: dict[tuple[str, str], list[Medicao]] = defaultdict(list)

    for medicao in todas:
        chave = (medicao.bloco, medicao.especie, medicao.tratamento)
        plantas_do_tratamento[medicao.tratamento].add(chave)
        medicoes_do_periodo[(medicao.tratamento, _periodo(medicao))].append(medicao)
        if not medicao.viva and chave not in primeira_morte:
            primeira_morte[chave] = _periodo(medicao)

    resultado = []
    for tratamento in Tratamento:
        chaves = plantas_do_tratamento.get(tratamento.value)
        if not chaves:
            continue
        total_plantas = len(chaves)
        for periodo in periodos:
            do_mes = medicoes_do_periodo.get((tratamento.value, periodo), [])
            alturas = [m.altura for m in do_mes if m.altura is not None]
            diametros = [v for m in do_mes if (v := _diametro_efetivo(m)) is not None]
            mortas_ate_aqui = sum(
                1 for chave in chaves if primeira_morte.get(chave, _NUNCA_MORREU) <= periodo
            )
            resultado.append(
                PontoEvolucaoTratamento(
                    tratamento=tratamento,
                    periodo=periodo,
                    altura_media=round(sum(alturas) / len(alturas), 1) if alturas else None,
                    diametro_medio=round(sum(diametros) / len(diametros), 2)
                    if diametros
                    else None,
                    percentual_mortas_acumulado=round(mortas_ate_aqui / total_plantas * 100, 1),
                )
            )
    return resultado


@router.get("/injuria-vs-sobrevivencia", response_model=list[InjuriaVsSobrevivencia])
def injuria_vs_sobrevivencia(db: Session = Depends(get_db)) -> list[InjuriaVsSobrevivencia]:
    """Para cada tipo de injúria (estado atual de cada planta), qual a taxa
    de mortalidade entre as plantas que têm essa injúria, comparada com a
    taxa de mortalidade geral (delta = taxa da injúria - taxa geral)."""
    atuais = _medicoes_atuais(db)
    total = len(atuais)
    taxa_geral = sum(1 for m in atuais if not m.viva) / total * 100 if total else 0.0

    resultado = []
    for injuria in Injuria:
        com_injuria = [m for m in atuais if injuria.value in m.injurias]
        n = len(com_injuria)
        if n == 0:
            continue
        taxa = sum(1 for m in com_injuria if not m.viva) / n * 100
        resultado.append(
            InjuriaVsSobrevivencia(
                injuria=injuria,
                n=n,
                taxa_mortalidade=round(taxa, 1),
                delta=round(taxa - taxa_geral, 1),
            )
        )
    return sorted(resultado, key=lambda r: r.delta, reverse=True)
