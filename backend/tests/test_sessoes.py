from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Medicao, Sessao


def _planta_payload(**overrides):
    payload = {
        "especie": "MB",
        "tratamento": "T6",
        "altura": 11.9,
        "tem_folhas": True,
        "viva": True,
        "tem_daninha": False,
        "injurias": [],
        "observacao": None,
    }
    payload.update(overrides)
    return payload


def test_create_sessao(client: TestClient):
    response = client.post("/sessoes", json={"bloco": 10})
    assert response.status_code == 201

    body = response.json()
    assert body["bloco"] == 10
    assert body["finalizada_em"] is None
    assert body["total_plantas"] == 0
    assert body["total_completas"] == 0


def test_create_sessao_bloqueia_segunda_sessao_aberta_no_mesmo_bloco(client: TestClient):
    primeira = client.post("/sessoes", json={"bloco": 10}).json()

    response = client.post("/sessoes", json={"bloco": 10})
    assert response.status_code == 409
    assert response.json()["detail"]["sessao_id"] == primeira["id"]


def test_create_sessao_permite_bloco_diferente(client: TestClient):
    client.post("/sessoes", json={"bloco": 10})
    response = client.post("/sessoes", json={"bloco": 11})
    assert response.status_code == 201


def test_get_sessao_inexistente_retorna_404(client: TestClient):
    assert client.get("/sessoes/999").status_code == 404


def test_list_sessoes(client: TestClient):
    client.post("/sessoes", json={"bloco": 1})
    client.post("/sessoes", json={"bloco": 2})

    response = client.get("/sessoes")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_sessao_aberta(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload())

    response = client.delete(f"/sessoes/{sessao['id']}")
    assert response.status_code == 204
    assert client.get(f"/sessoes/{sessao['id']}").status_code == 404


def test_delete_sessao_finalizada_bloqueia(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta = client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload()).json()
    client.patch(f"/sessoes/{sessao['id']}/plantas/{planta['id']}", json={"diametro1": 2.0})
    client.post(f"/sessoes/{sessao['id']}/finalizar")

    response = client.delete(f"/sessoes/{sessao['id']}")
    assert response.status_code == 409
    assert client.get(f"/sessoes/{sessao['id']}").status_code == 200


def test_delete_sessao_inexistente_retorna_404(client: TestClient):
    assert client.delete("/sessoes/999").status_code == 404


def test_add_planta_fica_incompleta_sem_diametro(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()

    response = client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload())
    assert response.status_code == 201

    body = response.json()
    assert body["especie"] == "MB"
    assert body["diametro1"] is None
    assert body["completa"] is False


def test_add_planta_bloqueia_especie_tratamento_duplicado(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    client.post(
        f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(especie="MB", tratamento="T6")
    )

    response = client.post(
        f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(especie="MB", tratamento="T6")
    )
    assert response.status_code == 409


def test_update_planta_preenche_diametro_e_marca_completa(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta = client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload()).json()
    assert planta["completa"] is False

    response = client.patch(
        f"/sessoes/{sessao['id']}/plantas/{planta['id']}",
        json={"diametro1": 1.963, "diametro2": None},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["diametro1"] == 1.96
    assert body["completa"] is True
    assert body["diametro_preenchido_em"] is not None


def test_update_planta_sem_altura_continua_incompleta(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta = client.post(
        f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(altura=None)
    ).json()

    response = client.patch(
        f"/sessoes/{sessao['id']}/plantas/{planta['id']}", json={"diametro1": 2.0}
    )
    assert response.json()["completa"] is False


def test_update_planta_inexistente_retorna_404(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    response = client.patch(f"/sessoes/{sessao['id']}/plantas/999", json={"diametro1": 2.0})
    assert response.status_code == 404


def test_delete_planta(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta = client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload()).json()

    response = client.delete(f"/sessoes/{sessao['id']}/plantas/{planta['id']}")
    assert response.status_code == 204

    detalhe = client.get(f"/sessoes/{sessao['id']}").json()
    assert detalhe["plantas"] == []


def test_finalizar_bloqueia_sessao_vazia(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    response = client.post(f"/sessoes/{sessao['id']}/finalizar")
    assert response.status_code == 400


def test_finalizar_bloqueia_com_plantas_incompletas(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload())

    response = client.post(f"/sessoes/{sessao['id']}/finalizar")
    assert response.status_code == 400


def test_finalizar_cria_medicoes_com_data_da_fase_1(client: TestClient, db_session: Session):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta1 = client.post(
        f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(especie="MB", tratamento="T6")
    ).json()
    planta2 = client.post(
        f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(especie="CF", tratamento="T1")
    ).json()
    client.patch(f"/sessoes/{sessao['id']}/plantas/{planta1['id']}", json={"diametro1": 2.0})
    client.patch(f"/sessoes/{sessao['id']}/plantas/{planta2['id']}", json={"diametro1": 3.0})

    response = client.post(f"/sessoes/{sessao['id']}/finalizar")
    assert response.status_code == 200

    body = response.json()
    assert body["finalizada_em"] is not None
    assert body["total_completas"] == 2

    # Compara via o mesmo caminho de leitura do SQLAlchemy (db_session) pros
    # dois lados, pra não depender de como sqlite/timezone arredondam o
    # datetime na volta de um round-trip por JSON.
    sessao_db = db_session.get(Sessao, sessao["id"])
    plantas_db = {p.especie: p for p in sessao_db.plantas}
    medicoes_db = {
        m.especie: m for m in db_session.query(Medicao).filter(Medicao.bloco == 10).all()
    }

    assert medicoes_db["MB"].data_medicao == plantas_db["MB"].criada_em
    assert medicoes_db["CF"].data_medicao == plantas_db["CF"].criada_em


def test_sessao_finalizada_bloqueia_novas_alteracoes(client: TestClient):
    sessao = client.post("/sessoes", json={"bloco": 10}).json()
    planta = client.post(f"/sessoes/{sessao['id']}/plantas", json=_planta_payload()).json()
    client.patch(f"/sessoes/{sessao['id']}/plantas/{planta['id']}", json={"diametro1": 2.0})
    client.post(f"/sessoes/{sessao['id']}/finalizar")

    assert client.post(f"/sessoes/{sessao['id']}/finalizar").status_code == 409
    assert (
        client.post(
            f"/sessoes/{sessao['id']}/plantas", json=_planta_payload(tratamento="T7")
        ).status_code
        == 409
    )
    assert (
        client.patch(
            f"/sessoes/{sessao['id']}/plantas/{planta['id']}", json={"diametro1": 3.0}
        ).status_code
        == 409
    )
    assert (
        client.delete(f"/sessoes/{sessao['id']}/plantas/{planta['id']}").status_code == 409
    )
