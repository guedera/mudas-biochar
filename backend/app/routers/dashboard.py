from collections import Counter, defaultdict
from collections.abc import Callable
from datetime import date, datetime, timedelta
from statistics import fmean

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import Especie, Injuria, Tratamento
from app.models import Medicao
from app.schemas import (
    AlturaPorTratamento,
    BlocoPorCrescimento,
    ContagemInjuria,
    DiametroPorTratamento,
    MortalidadePorBloco,
    MortalidadePorTratamento,
    PontoEvolucaoBloco,
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


@router.get("/mortalidade-por-bloco", response_model=list[MortalidadePorBloco])
def mortalidade_por_bloco(db: Session = Depends(get_db)) -> list[MortalidadePorBloco]:
    """De todas as plantas mortas (pelo estado da medição mais recente de
    cada uma), qual o % de cada bloco."""
    mortas = [m for m in _medicoes_atuais(db) if not m.viva]
    total = len(mortas)
    contagem = Counter(m.bloco for m in mortas)
    return [
        MortalidadePorBloco(
            bloco=bloco,
            mortas=qtd,
            percentual=round(qtd / total * 100, 1) if total else 0.0,
        )
        for bloco, qtd in sorted(contagem.items())
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


def _medicoes_para_medias(
    db: Session, especie: Especie, data_inicio: date | None, data_fim: date | None
) -> list[Medicao]:
    """Medições usadas pra calcular médias por tratamento, filtradas por
    espécie. Sem período, usa o estado atual de cada planta (última
    medição) — igual ao resto do dashboard. Com `data_inicio` e/ou
    `data_fim` (extremos inclusivos), usa todas as medições feitas dentro
    da janela, não só a mais recente de cada planta: a média passa a
    refletir o que foi medido naquele período."""
    if data_inicio is None and data_fim is None:
        return [m for m in _medicoes_atuais(db) if m.especie == especie.value]

    query = db.query(Medicao).filter(Medicao.especie == especie.value)
    if data_inicio is not None:
        query = query.filter(Medicao.data_medicao >= datetime.combine(data_inicio, datetime.min.time()))
    if data_fim is not None:
        fim = datetime.combine(data_fim, datetime.min.time()) + timedelta(days=1)
        query = query.filter(Medicao.data_medicao < fim)
    return query.all()


def _agrupar_por_tratamento(
    medicoes: list[Medicao], valor_de: Callable[[Medicao], float | None]
) -> dict[str, list[float]]:
    agrupado: dict[str, list[float]] = {}
    for medicao in medicoes:
        valor = valor_de(medicao)
        if valor is None:
            continue
        agrupado.setdefault(medicao.tratamento, []).append(valor)
    return agrupado


@router.get("/diametro-por-tratamento", response_model=list[DiametroPorTratamento])
def diametro_por_tratamento(
    especie: Especie,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
) -> list[DiametroPorTratamento]:
    """Diâmetro médio por tratamento, para uma espécie — ver
    `_medicoes_para_medias` pra semântica de `data_inicio`/`data_fim`.
    Quando a planta tem Diâmetro 1 e 2 (caule quadrado), usa a média dos
    dois."""
    agrupado = _agrupar_por_tratamento(
        _medicoes_para_medias(db, especie, data_inicio, data_fim), _diametro_efetivo
    )
    return [
        DiametroPorTratamento(
            tratamento=tratamento,
            diametro_medio=round(sum(valores) / len(valores), 2),
            n=len(valores),
        )
        for tratamento in Tratamento
        if (valores := agrupado.get(tratamento.value))
    ]


@router.get("/altura-por-tratamento", response_model=list[AlturaPorTratamento])
def altura_por_tratamento(
    especie: Especie,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
) -> list[AlturaPorTratamento]:
    """Altura média por tratamento, para uma espécie — mesma semântica de
    período que `/diametro-por-tratamento`."""
    agrupado = _agrupar_por_tratamento(
        _medicoes_para_medias(db, especie, data_inicio, data_fim), lambda m: m.altura
    )
    return [
        AlturaPorTratamento(
            tratamento=tratamento,
            altura_media=round(sum(valores) / len(valores), 1),
            n=len(valores),
        )
        for tratamento in Tratamento
        if (valores := agrupado.get(tratamento.value))
    ]


def _periodo(medicao: Medicao) -> str:
    return medicao.data_medicao.strftime("%Y-%m")


def _evolucao_por_tratamento(todas: list[Medicao]) -> list[PontoEvolucaoTratamento]:
    """Evolução mês a mês de cada tratamento, ao longo de todas as medições
    recebidas (não só a mais recente): altura média, diâmetro médio (das
    medições daquele mês) e % de mortalidade acumulada (planta conta como
    morta a partir do mês da primeira medição em que ela aparece morta —
    sobrevivência não "ressuscita", então esse % nunca cai).

    `todas` precisa vir ordenada por `data_medicao`: a "primeira morte" de
    cada planta é a primeira que aparece nessa ordem."""
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


@router.get("/evolucao", response_model=list[PontoEvolucaoTratamento])
def evolucao(db: Session = Depends(get_db)) -> list[PontoEvolucaoTratamento]:
    """Evolução mês a mês de cada tratamento, com as medições de todas as
    espécies — ver `_evolucao_por_tratamento` pra semântica."""
    todas = db.query(Medicao).order_by(Medicao.data_medicao).all()
    return _evolucao_por_tratamento(todas)


@router.get("/evolucao-por-especie", response_model=list[PontoEvolucaoTratamento])
def evolucao_por_especie(
    especie: Especie, db: Session = Depends(get_db)
) -> list[PontoEvolucaoTratamento]:
    """Igual a `/evolucao`, mas só com as medições de uma espécie: uma linha
    por tratamento daquela espécie (`especie` obrigatório)."""
    todas = (
        db.query(Medicao)
        .filter(Medicao.especie == especie.value)
        .order_by(Medicao.data_medicao)
        .all()
    )
    return _evolucao_por_tratamento(todas)


@router.get("/evolucao-por-bloco", response_model=list[PontoEvolucaoBloco])
def evolucao_por_bloco(db: Session = Depends(get_db)) -> list[PontoEvolucaoBloco]:
    """Igual a `/evolucao`, mas agrupado por bloco em vez de tratamento."""
    todas = db.query(Medicao).order_by(Medicao.data_medicao).all()
    if not todas:
        return []

    periodos = sorted({_periodo(m) for m in todas})
    plantas_do_bloco: dict[int, set[tuple[int, str, str]]] = defaultdict(set)
    primeira_morte: dict[tuple[int, str, str], str] = {}
    medicoes_do_periodo: dict[tuple[int, str], list[Medicao]] = defaultdict(list)

    for medicao in todas:
        chave = (medicao.bloco, medicao.especie, medicao.tratamento)
        plantas_do_bloco[medicao.bloco].add(chave)
        medicoes_do_periodo[(medicao.bloco, _periodo(medicao))].append(medicao)
        if not medicao.viva and chave not in primeira_morte:
            primeira_morte[chave] = _periodo(medicao)

    resultado = []
    for bloco in sorted(plantas_do_bloco):
        chaves = plantas_do_bloco[bloco]
        total_plantas = len(chaves)
        for periodo in periodos:
            do_mes = medicoes_do_periodo.get((bloco, periodo), [])
            alturas = [m.altura for m in do_mes if m.altura is not None]
            diametros = [v for m in do_mes if (v := _diametro_efetivo(m)) is not None]
            mortas_ate_aqui = sum(
                1 for chave in chaves if primeira_morte.get(chave, _NUNCA_MORREU) <= periodo
            )
            resultado.append(
                PontoEvolucaoBloco(
                    bloco=bloco,
                    periodo=periodo,
                    altura_media=round(sum(alturas) / len(alturas), 1) if alturas else None,
                    diametro_medio=round(sum(diametros) / len(diametros), 2)
                    if diametros
                    else None,
                    percentual_mortas_acumulado=round(mortas_ate_aqui / total_plantas * 100, 1),
                )
            )
    return resultado


_DIAS_POR_MES = 30
_INTERVALO_MINIMO_DIAS = 1

# Ordem em que as posições "reivindicam" um bloco quando há poucos blocos e
# duas posições caem no mesmo (os extremos têm prioridade sobre os quartis).
_POSICOES = (("maior", 1.0), ("menor", 0.0), ("mediana", 0.5), ("75%", 0.75), ("25%", 0.25))


def _taxa_de_crescimento_por_bloco(
    todas: list[Medicao], valor_de: Callable[[Medicao], float | None]
) -> dict[int, float]:
    """Taxa de crescimento de cada bloco, por mês de 30 dias (cm/mês pra
    altura, mm/mês pro diâmetro).

    Cada planta (bloco+espécie+tratamento) cresce da primeira à última
    medição dela que tem o valor; o bloco soma o crescimento de suas plantas
    e divide pela soma dos dias entre essas medições — plantas medidas num
    intervalo curto pesam pouco, em vez de uma taxa instável por planta.
    Planta com uma só medição (ou com menos de 1 dia entre a primeira e a
    última) não conta. `todas` precisa vir ordenada por `data_medicao`."""
    por_planta: dict[tuple[int, str, str], list[tuple[datetime, float]]] = defaultdict(list)
    for medicao in todas:
        valor = valor_de(medicao)
        if valor is not None:
            chave = (medicao.bloco, medicao.especie, medicao.tratamento)
            por_planta[chave].append((medicao.data_medicao, valor))

    crescimento: dict[int, float] = defaultdict(float)
    dias: dict[int, float] = defaultdict(float)
    for (bloco, _, _), pontos in por_planta.items():
        (inicio, valor_inicial), (fim, valor_final) = pontos[0], pontos[-1]
        intervalo = (fim - inicio).total_seconds() / 86400
        if intervalo < _INTERVALO_MINIMO_DIAS:
            continue
        crescimento[bloco] += valor_final - valor_inicial
        dias[bloco] += intervalo
    return {bloco: crescimento[bloco] / dias[bloco] * _DIAS_POR_MES for bloco in dias}


def _posicao_no_ranking(taxas: dict[int, float]) -> dict[int, float]:
    """Posição de cada bloco no ranking da taxa, de 0 (menor) a 1 (maior).
    Empates dividem a posição do meio."""
    n = len(taxas)
    if n == 1:
        return {bloco: 0.5 for bloco in taxas}
    valores = list(taxas.values())
    return {
        bloco: (
            sum(1 for outro in valores if outro < taxa)
            + (sum(1 for outro in valores if outro == taxa) - 1) / 2
        )
        / (n - 1)
        for bloco, taxa in taxas.items()
    }


@router.get("/blocos-por-crescimento", response_model=list[BlocoPorCrescimento])
def blocos_por_crescimento(db: Session = Depends(get_db)) -> list[BlocoPorCrescimento]:
    """Blocos que representam a distribuição da taxa de crescimento: o de
    maior, o de 75%, a mediana, o de 25% e o de menor crescimento (do maior
    pro menor). Altura e diâmetro pesam igual: o score do bloco é a média da
    posição dele no ranking de cada um (ver `_taxa_de_crescimento_por_bloco`).
    Com menos de 5 blocos com taxa calculável, devolve só os que existem."""
    todas = db.query(Medicao).order_by(Medicao.data_medicao).all()
    taxas_altura = _taxa_de_crescimento_por_bloco(todas, lambda m: m.altura)
    taxas_diametro = _taxa_de_crescimento_por_bloco(todas, _diametro_efetivo)

    posicoes = [_posicao_no_ranking(taxas) for taxas in (taxas_altura, taxas_diametro) if taxas]
    blocos = set(taxas_altura) | set(taxas_diametro)
    if not blocos:
        return []
    score = {bloco: fmean(p[bloco] for p in posicoes if bloco in p) for bloco in blocos}

    ranking = sorted(blocos, key=lambda bloco: (score[bloco], bloco))  # do menor pro maior
    escolhidos: dict[int, str] = {}
    for posicao, fracao in _POSICOES:
        escolhidos.setdefault(int(fracao * (len(ranking) - 1) + 0.5), posicao)

    def arredondar(taxas: dict[int, float], bloco: int, casas: int) -> float | None:
        return round(taxas[bloco], casas) if bloco in taxas else None

    return [
        BlocoPorCrescimento(
            bloco=ranking[indice],
            posicao=escolhidos[indice],
            taxa_altura=arredondar(taxas_altura, ranking[indice], 2),
            taxa_diametro=arredondar(taxas_diametro, ranking[indice], 3),
            score=round(score[ranking[indice]], 3),
        )
        for indice in sorted(escolhidos, reverse=True)
    ]
