from datetime import datetime, timezone

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
    # planta 2 (T1): jan viva altura 9.0, fev morta (morre em fevereiro)
    _medicao_em(db_session, janeiro, bloco=2, tratamento="T1", altura=9.0, viva=True)
    _medicao_em(db_session, fevereiro, bloco=2, tratamento="T1", altura=9.5, viva=False)

    response = client.get("/dashboard/evolucao")
    assert response.status_code == 200
    pontos = {(row["tratamento"], row["periodo"]): row for row in response.json()}

    jan = pontos[("T1", "2026-01")]
    fev = pontos[("T1", "2026-02")]

    assert jan["altura_media"] == 7.0  # media(5.0, 9.0)
    assert jan["percentual_mortas_acumulado"] == 0.0  # ninguém morreu ainda
    assert fev["altura_media"] == 8.2  # media(7.0, 9.5) = 8.25, arredondado a 1 casa
    assert fev["percentual_mortas_acumulado"] == 50.0  # 1 de 2 plantas morta


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


def test_injuria_vs_sobrevivencia_calcula_delta_em_relacao_a_taxa_geral(client: TestClient):
    # taxa geral: 2 de 4 mortas = 50%
    client.post("/medicoes", json=_payload(bloco=1, viva=True, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=2, viva=False, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=3, viva=False, injurias=["AA"]))
    client.post("/medicoes", json=_payload(bloco=4, viva=True, injurias=[]))

    response = client.get("/dashboard/injuria-vs-sobrevivencia")
    assert response.status_code == 200
    body = {row["injuria"]: row for row in response.json()}

    # H: 1 de 2 mortas = 50% -> delta 0 em relação à taxa geral (50%)
    assert body["H"]["taxa_mortalidade"] == 50.0
    assert body["H"]["delta"] == 0.0
    # AA: 1 de 1 morta = 100% -> delta +50
    assert body["AA"]["taxa_mortalidade"] == 100.0
    assert body["AA"]["delta"] == 50.0
    assert "P" not in body  # ninguém tem essa injúria
