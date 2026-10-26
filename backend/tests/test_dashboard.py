from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Medicao


def _payload(**overrides):
    payload = {
        "bloco": 1,
        "especie": "MB",
        "tratamento": "T6",
        "altura": 11.9,
        "diametro1": 2.0,
        "diametro2": None,
        "tem_folhas": True,
        "viva": True,
        "tem_daninha": False,
        "injurias": [],
        "observacao": None,
    }
    payload.update(overrides)
    return payload


def test_resumo_conta_estado_mais_recente_de_cada_planta(client: TestClient):
    # mesma planta: primeira medição viva, segunda (mais recente) morta -> conta como morta
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T6", viva=True))
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T6", viva=False))
    # outra planta: primeira morta, segunda (mais recente) viva -> conta como viva
    client.post("/medicoes", json=_payload(bloco=2, especie="MB", tratamento="T6", viva=False))
    client.post("/medicoes", json=_payload(bloco=2, especie="MB", tratamento="T6", viva=True))

    response = client.get("/dashboard/resumo")
    assert response.status_code == 200
    body = response.json()
    assert body["total_plantas"] == 2
    assert body["total_mortas"] == 1
    assert body["total_vivas"] == 1
    assert body["percentual_mortas"] == 50.0


def test_mortalidade_por_tratamento_usa_ultima_medicao_por_planta(client: TestClient):
    # planta 1 (T1): viva -> depois morta = conta morta em T1
    client.post("/medicoes", json=_payload(bloco=1, tratamento="T1", viva=True))
    client.post("/medicoes", json=_payload(bloco=1, tratamento="T1", viva=False))
    # planta 2 (T2): morta
    client.post("/medicoes", json=_payload(bloco=2, tratamento="T2", viva=False))
    # planta 3 (T2): morta
    client.post("/medicoes", json=_payload(bloco=3, tratamento="T2", viva=False))
    # planta 4 (T3): viva o tempo todo, não deve contar
    client.post("/medicoes", json=_payload(bloco=4, tratamento="T3", viva=True))

    response = client.get("/dashboard/mortalidade-por-tratamento")
    assert response.status_code == 200
    body = {row["tratamento"]: row for row in response.json()}

    assert body["T1"]["mortas"] == 1
    assert body["T1"]["percentual"] == round(1 / 3 * 100, 1)
    assert body["T2"]["mortas"] == 2
    assert body["T2"]["percentual"] == round(2 / 3 * 100, 1)
    assert "T3" not in body


def test_injurias_conta_apenas_estado_mais_recente(client: TestClient):
    # medição antiga com injúria H, mais recente sem nenhuma injúria -> não deve contar H
    client.post("/medicoes", json=_payload(bloco=1, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=1, injurias=[]))
    client.post("/medicoes", json=_payload(bloco=2, injurias=["AA", "P"]))
    client.post("/medicoes", json=_payload(bloco=3, injurias=["AA"]))

    response = client.get("/dashboard/injurias")
    assert response.status_code == 200
    body = {row["injuria"]: row["contagem"] for row in response.json()}

    assert "H" not in body
    assert body["AA"] == 2
    assert body["P"] == 1


def test_diametro_por_tratamento_filtra_por_especie_e_usa_ultima_medicao(client: TestClient):
    client.post(
        "/medicoes",
        json=_payload(bloco=1, especie="MB", tratamento="T1", diametro1=1.0, diametro2=None),
    )
    client.post(
        "/medicoes",
        json=_payload(bloco=1, especie="MB", tratamento="T1", diametro1=3.0, diametro2=None),
    )
    client.post(
        "/medicoes",
        json=_payload(bloco=2, especie="MB", tratamento="T1", diametro1=2.0, diametro2=4.0),
    )
    client.post(
        "/medicoes",
        json=_payload(bloco=3, especie="CF", tratamento="T1", diametro1=9.0, diametro2=None),
    )

    response = client.get("/dashboard/diametro-por-tratamento", params={"especie": "MB"})
    assert response.status_code == 200
    body = {row["tratamento"]: row for row in response.json()}

    assert set(body.keys()) == {"T1"}
    # planta 1 usa só a medição mais recente (3.0); planta 2 usa média(2,4)=3.0
    assert body["T1"]["diametro_medio"] == 3.0
    assert body["T1"]["n"] == 2


def test_diametro_por_tratamento_exige_especie(client: TestClient):
    response = client.get("/dashboard/diametro-por-tratamento")
    assert response.status_code == 422


def test_diametro_por_tratamento_com_periodo_usa_media_das_medicoes_do_periodo(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)

    _medicao_em(
        db_session, janeiro, bloco=1, especie="MB", tratamento="T1", diametro1=2.0, diametro2=None
    )
    _medicao_em(
        db_session, fevereiro, bloco=1, especie="MB", tratamento="T1", diametro1=6.0, diametro2=None
    )

    # sem período: comportamento de sempre, usa só a medição mais recente
    sem_periodo = client.get("/dashboard/diametro-por-tratamento", params={"especie": "MB"})
    body = {r["tratamento"]: r for r in sem_periodo.json()}
    assert body["T1"]["diametro_medio"] == 6.0
    assert body["T1"]["n"] == 1

    # período cobrindo só janeiro: usa só a medição feita naquele mês
    so_janeiro = client.get(
        "/dashboard/diametro-por-tratamento",
        params={"especie": "MB", "data_inicio": "2026-01-01", "data_fim": "2026-01-31"},
    )
    body = {r["tratamento"]: r for r in so_janeiro.json()}
    assert body["T1"]["diametro_medio"] == 2.0
    assert body["T1"]["n"] == 1

    # período cobrindo os dois meses: média das duas medições, não só a mais recente
    ambos = client.get(
        "/dashboard/diametro-por-tratamento",
        params={"especie": "MB", "data_inicio": "2026-01-01", "data_fim": "2026-02-28"},
    )
    body = {r["tratamento"]: r for r in ambos.json()}
    assert body["T1"]["diametro_medio"] == 4.0
    assert body["T1"]["n"] == 2


def test_altura_por_tratamento_com_periodo_usa_media_das_medicoes_do_periodo(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)

    _medicao_em(db_session, janeiro, bloco=1, especie="MB", tratamento="T1", altura=5.0)
    _medicao_em(db_session, fevereiro, bloco=1, especie="MB", tratamento="T1", altura=9.0)

    sem_periodo = client.get("/dashboard/altura-por-tratamento", params={"especie": "MB"})
    body = {r["tratamento"]: r for r in sem_periodo.json()}
    assert body["T1"]["altura_media"] == 9.0
    assert body["T1"]["n"] == 1

    ambos = client.get(
        "/dashboard/altura-por-tratamento",
        params={"especie": "MB", "data_inicio": "2026-01-01", "data_fim": "2026-02-28"},
    )
    body = {r["tratamento"]: r for r in ambos.json()}
    assert body["T1"]["altura_media"] == 7.0
    assert body["T1"]["n"] == 2


def test_altura_por_tratamento_exige_especie(client: TestClient):
    response = client.get("/dashboard/altura-por-tratamento")
    assert response.status_code == 422


def _medicao_em(db: Session, data: datetime, **overrides) -> Medicao:
    base = _payload()
    base.update(overrides)
    base["injurias"] = base.get("injurias", [])
    medicao = Medicao(
        bloco=base["bloco"],
        especie=base["especie"],
        tratamento=base["tratamento"],
        altura=base["altura"],
        diametro1=base["diametro1"],
        diametro2=base["diametro2"],
        tem_folhas=base["tem_folhas"],
        viva=base["viva"],
        tem_daninha=base["tem_daninha"],
        injurias=base["injurias"],
        observacao=base["observacao"],
        data_medicao=data,
    )
    db.add(medicao)
    db.commit()
    return medicao


def test_evolucao_calcula_media_por_periodo_e_mortalidade_acumulada(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)

    # planta 1 (T1): jan viva altura 5.0, fev viva altura 7.0
    _medicao_em(db_session, janeiro, bloco=1, tratamento="T1", altura=5.0, viva=True)
    _medicao_em(db_session, fevereiro, bloco=1, tratamento="T1", altura=7.0, viva=True)
    # planta 2 (T1): jan viva altura 9.0, fev morta (morre em fevereiro; a planta morta
    # é anotada em campo com altura 0.1)
    _medicao_em(db_session, janeiro, bloco=2, tratamento="T1", altura=9.0, viva=True)
    _medicao_em(db_session, fevereiro, bloco=2, tratamento="T1", altura=0.1, viva=False)

    response = client.get("/dashboard/evolucao")
    assert response.status_code == 200
    pontos = {(row["tratamento"], row["periodo"]): row for row in response.json()}

    jan = pontos[("T1", "2026-01")]
    fev = pontos[("T1", "2026-02")]

    assert jan["altura_media"] == 7.0  # media(5.0, 9.0)
    assert jan["percentual_mortas_acumulado"] == 0.0  # ninguém morreu ainda
    assert fev["altura_media"] == 7.0  # só a planta 1: a planta 2 morreu e não entra na média
    assert fev["percentual_mortas_acumulado"] == 50.0  # mas conta na mortalidade: 1 de 2 plantas


def test_evolucao_mortalidade_acumulada_nao_reverte(client: TestClient, db_session: Session):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)
    marco = datetime(2026, 3, 15, tzinfo=timezone.utc)

    _medicao_em(db_session, janeiro, bloco=1, tratamento="T2", viva=True)
    _medicao_em(db_session, fevereiro, bloco=1, tratamento="T2", viva=False)
    _medicao_em(db_session, marco, bloco=1, tratamento="T2", viva=False)

    response = client.get("/dashboard/evolucao")
    pontos = {row["periodo"]: row for row in response.json() if row["tratamento"] == "T2"}

    assert pontos["2026-01"]["percentual_mortas_acumulado"] == 0.0
    assert pontos["2026-02"]["percentual_mortas_acumulado"] == 100.0
    assert pontos["2026-03"]["percentual_mortas_acumulado"] == 100.0


def test_mortalidade_por_bloco_usa_ultima_medicao_por_planta(client: TestClient):
    # bloco 1: planta viva -> depois morta = conta morta no bloco 1
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T1", viva=True))
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T1", viva=False))
    # bloco 2: duas plantas mortas
    client.post("/medicoes", json=_payload(bloco=2, especie="MB", tratamento="T1", viva=False))
    client.post("/medicoes", json=_payload(bloco=2, especie="CF", tratamento="T2", viva=False))
    # bloco 3: viva o tempo todo, não deve aparecer
    client.post("/medicoes", json=_payload(bloco=3, viva=True))

    response = client.get("/dashboard/mortalidade-por-bloco")
    assert response.status_code == 200
    body = {row["bloco"]: row for row in response.json()}

    assert body[1]["mortas"] == 1
    assert body[1]["percentual"] == round(1 / 3 * 100, 1)
    assert body[2]["mortas"] == 2
    assert body[2]["percentual"] == round(2 / 3 * 100, 1)
    assert 3 not in body


def test_evolucao_por_bloco_calcula_media_por_periodo_e_mortalidade_acumulada(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)

    # bloco 1: planta 1 (jan viva altura 5.0, fev viva altura 7.0)
    _medicao_em(db_session, janeiro, bloco=1, especie="MB", tratamento="T1", altura=5.0, viva=True)
    _medicao_em(
        db_session, fevereiro, bloco=1, especie="MB", tratamento="T1", altura=7.0, viva=True
    )
    # bloco 1: planta 2 (jan viva altura 9.0, fev morta em fevereiro)
    _medicao_em(db_session, janeiro, bloco=1, especie="CF", tratamento="T2", altura=9.0, viva=True)
    _medicao_em(
        db_session, fevereiro, bloco=1, especie="CF", tratamento="T2", altura=0.1, viva=False
    )

    response = client.get("/dashboard/evolucao-por-bloco")
    assert response.status_code == 200
    pontos = {(row["bloco"], row["periodo"]): row for row in response.json()}

    jan = pontos[(1, "2026-01")]
    fev = pontos[(1, "2026-02")]

    assert jan["altura_media"] == 7.0  # media(5.0, 9.0)
    assert jan["percentual_mortas_acumulado"] == 0.0
    assert fev["altura_media"] == 7.0  # a planta que morreu em fevereiro não entra na média
    assert fev["percentual_mortas_acumulado"] == 50.0  # 1 de 2 plantas do bloco morreu


def test_evolucao_por_bloco_mortalidade_acumulada_nao_reverte(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)
    marco = datetime(2026, 3, 15, tzinfo=timezone.utc)

    _medicao_em(db_session, janeiro, bloco=5, viva=True)
    _medicao_em(db_session, fevereiro, bloco=5, viva=False)
    _medicao_em(db_session, marco, bloco=5, viva=False)

    response = client.get("/dashboard/evolucao-por-bloco")
    pontos = {row["periodo"]: row for row in response.json() if row["bloco"] == 5}

    assert pontos["2026-01"]["percentual_mortas_acumulado"] == 0.0
    assert pontos["2026-02"]["percentual_mortas_acumulado"] == 100.0
    assert pontos["2026-03"]["percentual_mortas_acumulado"] == 100.0


def test_evolucao_por_especie_so_considera_a_especie_pedida(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)

    _medicao_em(db_session, janeiro, bloco=1, especie="MB", tratamento="T1", altura=5.0, viva=True)
    _medicao_em(
        db_session, fevereiro, bloco=1, especie="MB", tratamento="T1", altura=0.1, viva=False
    )
    _medicao_em(db_session, janeiro, bloco=2, especie="MB", tratamento="T2", altura=9.0, viva=True)
    # outra espécie: não pode entrar nas médias nem nos tratamentos de MB
    _medicao_em(db_session, janeiro, bloco=1, especie="CF", tratamento="T3", altura=50.0, viva=False)
    _medicao_em(db_session, janeiro, bloco=3, especie="CF", tratamento="T1", altura=50.0, viva=False)

    response = client.get("/dashboard/evolucao-por-especie", params={"especie": "MB"})
    assert response.status_code == 200
    pontos = {(row["tratamento"], row["periodo"]): row for row in response.json()}

    assert {tratamento for tratamento, _ in pontos} == {"T1", "T2"}  # T3 é só de CF
    assert pontos[("T1", "2026-01")]["altura_media"] == 5.0  # CF/T1 (50.0) ficou de fora
    assert pontos[("T1", "2026-01")]["percentual_mortas_acumulado"] == 0.0
    # em fevereiro só a planta morta foi medida: sem planta viva, sem média
    assert pontos[("T1", "2026-02")]["altura_media"] is None
    assert pontos[("T1", "2026-02")]["percentual_mortas_acumulado"] == 100.0
    assert pontos[("T2", "2026-01")]["altura_media"] == 9.0
    # T2 não foi medido em fevereiro: o ponto existe (grade completa), sem média
    assert pontos[("T2", "2026-02")]["altura_media"] is None
    assert pontos[("T2", "2026-02")]["percentual_mortas_acumulado"] == 0.0


def test_evolucao_por_especie_exige_especie_valida(client: TestClient):
    assert client.get("/dashboard/evolucao-por-especie").status_code == 422
    response = client.get("/dashboard/evolucao-por-especie", params={"especie": "XX"})
    assert response.status_code == 422


def test_evolucao_por_especie_sem_medicoes_devolve_lista_vazia(client: TestClient):
    response = client.get("/dashboard/evolucao-por-especie", params={"especie": "MB"})
    assert response.status_code == 200
    assert response.json() == []


def _planta_com_crescimento(
    db: Session,
    bloco: int,
    *,
    ganho_altura: float,
    ganho_diametro: float | None = 0.0,
    dias: int = 30,
    especie: str = "MB",
    tratamento: str = "T1",
):
    """Uma planta medida duas vezes, `dias` de intervalo: altura 10 -> 10 +
    ganho_altura e diâmetro 1 -> 1 + ganho_diametro (None = sem diâmetro)."""
    inicio = datetime(2026, 1, 15, tzinfo=timezone.utc)
    diametros = (None, None) if ganho_diametro is None else (1.0, 1.0 + ganho_diametro)
    for data, altura, diametro in (
        (inicio, 10.0, diametros[0]),
        (inicio + timedelta(days=dias), 10.0 + ganho_altura, diametros[1]),
    ):
        _medicao_em(
            db, data, bloco=bloco, especie=especie, tratamento=tratamento,
            altura=altura, diametro1=diametro,
        )


def test_blocos_por_crescimento_escolhe_extremos_mediana_e_quartis(
    client: TestClient, db_session: Session
):
    # 30 dias de intervalo: a taxa em cm/mês é o próprio ganho. Bloco N cresce N cm.
    for bloco in range(1, 10):
        _planta_com_crescimento(db_session, bloco, ganho_altura=bloco, ganho_diametro=bloco / 10)

    response = client.get("/dashboard/blocos-por-crescimento")
    assert response.status_code == 200
    body = response.json()

    assert [(b["bloco"], b["posicao"]) for b in body] == [
        (9, "maior"),
        (7, "75%"),
        (5, "mediana"),
        (3, "25%"),
        (1, "menor"),
    ]
    assert body[0]["taxa_altura"] == 9.0
    assert body[0]["taxa_diametro"] == 0.9
    assert body[0]["score"] == 1.0
    assert body[-1]["score"] == 0.0


def test_blocos_por_crescimento_pesa_altura_e_diametro_igual(
    client: TestClient, db_session: Session
):
    # Só pela altura (do menor pro maior) seria 3, 4, 2, 1: o bloco 2 ficaria na
    # mediana. Com o diâmetro junto o bloco 4 passa o 2 (o 2 tem o menor diâmetro
    # de todos) e vira a mediana.
    _planta_com_crescimento(db_session, 1, ganho_altura=5, ganho_diametro=0.5)
    _planta_com_crescimento(db_session, 2, ganho_altura=4, ganho_diametro=0.1)
    _planta_com_crescimento(db_session, 3, ganho_altura=1, ganho_diametro=0.3)
    _planta_com_crescimento(db_session, 4, ganho_altura=2, ganho_diametro=0.4)

    body = client.get("/dashboard/blocos-por-crescimento").json()

    assert [(b["bloco"], b["posicao"]) for b in body] == [
        (1, "maior"),
        (4, "mediana"),
        (2, "25%"),
        (3, "menor"),
    ]


def test_blocos_por_crescimento_pondera_pelo_tempo_entre_medicoes(
    client: TestClient, db_session: Session
):
    # Mesmo bloco, duas plantas: +3 cm em 30 dias e +0 cm em 60 dias.
    # Taxa = (3 + 0) / (30 + 60) * 30 = 1 cm/mês (e não a média das taxas, 1,5).
    _planta_com_crescimento(db_session, 1, ganho_altura=3, dias=30, especie="MB")
    _planta_com_crescimento(db_session, 1, ganho_altura=0, dias=60, especie="CF")

    body = client.get("/dashboard/blocos-por-crescimento").json()

    assert body == [
        {"bloco": 1, "posicao": "maior", "taxa_altura": 1.0, "taxa_diametro": 0.0, "score": 0.5}
    ]


def test_blocos_por_crescimento_ignora_planta_sem_intervalo_para_calcular(
    client: TestClient, db_session: Session
):
    _planta_com_crescimento(db_session, 1, ganho_altura=3)
    # bloco 2: uma só medição; bloco 3: duas medições no mesmo dia
    inicio = datetime(2026, 1, 15, tzinfo=timezone.utc)
    _medicao_em(db_session, inicio, bloco=2, especie="MB", tratamento="T1")
    _medicao_em(db_session, inicio, bloco=3, especie="MB", tratamento="T1")
    _medicao_em(db_session, inicio + timedelta(hours=2), bloco=3, especie="MB", tratamento="T1")

    body = client.get("/dashboard/blocos-por-crescimento").json()

    assert [b["bloco"] for b in body] == [1]


def test_blocos_por_crescimento_sem_diametro_rankeia_so_pela_altura(
    client: TestClient, db_session: Session
):
    _planta_com_crescimento(db_session, 1, ganho_altura=1, ganho_diametro=None)
    _planta_com_crescimento(db_session, 2, ganho_altura=2, ganho_diametro=None)

    body = client.get("/dashboard/blocos-por-crescimento").json()

    assert [(b["bloco"], b["posicao"]) for b in body] == [(2, "maior"), (1, "menor")]
    assert all(b["taxa_diametro"] is None for b in body)


def test_blocos_por_crescimento_sem_medicoes_devolve_lista_vazia(client: TestClient):
    response = client.get("/dashboard/blocos-por-crescimento")
    assert response.status_code == 200
    assert response.json() == []


# --- planta morta não entra nas médias de altura e diâmetro -------------------------
# (em campo ela é anotada com altura 0.1 e diâmetro 0.01, que não são medidas)


def test_altura_e_diametro_por_tratamento_ignoram_planta_morta(client: TestClient):
    client.post(
        "/medicoes",
        json=_payload(bloco=1, especie="MB", tratamento="T1", altura=10.0, diametro1=2.0),
    )
    client.post(
        "/medicoes",
        json=_payload(
            bloco=2, especie="MB", tratamento="T1", altura=0.1, diametro1=0.01, viva=False
        ),
    )
    # T2 só tem planta morta: não aparece nas médias
    client.post(
        "/medicoes",
        json=_payload(
            bloco=3, especie="MB", tratamento="T2", altura=0.1, diametro1=0.01, viva=False
        ),
    )

    altura = client.get("/dashboard/altura-por-tratamento", params={"especie": "MB"}).json()
    diametro = client.get("/dashboard/diametro-por-tratamento", params={"especie": "MB"}).json()

    assert altura == [{"tratamento": "T1", "altura_media": 10.0, "n": 1}]
    assert diametro == [{"tratamento": "T1", "diametro_medio": 2.0, "n": 1}]


def test_medias_com_periodo_ignoram_a_medicao_da_planta_morta(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)
    _medicao_em(db_session, janeiro, bloco=1, especie="MB", tratamento="T1", altura=10.0)
    _medicao_em(
        db_session, fevereiro, bloco=1, especie="MB", tratamento="T1", altura=0.1, viva=False
    )

    response = client.get(
        "/dashboard/altura-por-tratamento",
        params={"especie": "MB", "data_inicio": "2026-01-01", "data_fim": "2026-02-28"},
    )

    assert response.json() == [{"tratamento": "T1", "altura_media": 10.0, "n": 1}]


def test_evolucao_mes_so_com_planta_morta_fica_sem_media_mas_conta_na_mortalidade(
    client: TestClient, db_session: Session
):
    janeiro = datetime(2026, 1, 15, tzinfo=timezone.utc)
    fevereiro = datetime(2026, 2, 15, tzinfo=timezone.utc)
    _medicao_em(db_session, janeiro, bloco=1, tratamento="T1", altura=10.0, diametro1=2.0)
    _medicao_em(
        db_session, fevereiro, bloco=1, tratamento="T1", altura=0.1, diametro1=0.01, viva=False
    )

    pontos = {
        (r["tratamento"], r["periodo"]): r for r in client.get("/dashboard/evolucao").json()
    }
    por_bloco = {(r["bloco"], r["periodo"]): r for r in client.get("/dashboard/evolucao-por-bloco").json()}

    for fev in (pontos[("T1", "2026-02")], por_bloco[(1, "2026-02")]):
        assert fev["altura_media"] is None
        assert fev["diametro_medio"] is None
        assert fev["percentual_mortas_acumulado"] == 100.0
    assert pontos[("T1", "2026-01")]["altura_media"] == 10.0
    assert por_bloco[(1, "2026-01")]["diametro_medio"] == 2.0


def test_blocos_por_crescimento_ignora_a_medicao_de_planta_morta(
    client: TestClient, db_session: Session
):
    # planta A: cresce 3 cm em 30 dias
    _planta_com_crescimento(db_session, 1, ganho_altura=3, especie="MB")
    # planta B, mesmo bloco: viva em jan (10 cm) e morta em fev (anotada com 0.1)
    inicio = datetime(2026, 1, 15, tzinfo=timezone.utc)
    _medicao_em(db_session, inicio, bloco=1, especie="CF", tratamento="T1", altura=10.0)
    _medicao_em(
        db_session,
        inicio + timedelta(days=30),
        bloco=1,
        especie="CF",
        tratamento="T1",
        altura=0.1,
        diametro1=0.01,
        viva=False,
    )

    body = client.get("/dashboard/blocos-por-crescimento").json()

    # contando a morta seria (3 + (0.1 - 10)) / 2 = -3.45 cm/mês
    assert body[0]["taxa_altura"] == 3.0
