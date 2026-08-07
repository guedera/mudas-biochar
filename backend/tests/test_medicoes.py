from fastapi.testclient import TestClient


def _payload(**overrides):
    payload = {
        "bloco": 30,
        "especie": "MB",
        "tratamento": "T6",
        "altura": 11.94,
        "diametro1": 1.963,
        "diametro2": None,
        "tem_folhas": True,
        "viva": True,
        "tem_daninha": False,
        "injurias": ["H"],
        "observacao": "primeira medição",
    }
    payload.update(overrides)
    return payload


def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_medicao_rounds_altura_e_diametro(client: TestClient):
    response = client.post("/medicoes", json=_payload())
    assert response.status_code == 201

    body = response.json()
    assert body["altura"] == 11.9
    assert body["diametro1"] == 1.96
    assert body["diametro2"] is None
    assert body["injurias"] == ["H"]
    assert body["id"] is not None
    assert body["data_medicao"] is not None


def test_create_medicao_rejeita_especie_invalida(client: TestClient):
    response = client.post("/medicoes", json=_payload(especie="XX"))
    assert response.status_code == 422


def test_list_medicoes_filtra_por_planta(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=30, especie="MB", tratamento="T6"))
    client.post("/medicoes", json=_payload(bloco=30, especie="MB", tratamento="T6"))
    client.post("/medicoes", json=_payload(bloco=31, especie="MB", tratamento="T6"))

    response = client.get("/medicoes", params={"bloco": 30, "especie": "MB", "tratamento": "T6"})
    assert response.status_code == 200

    medicoes = response.json()
    assert len(medicoes) == 2
    assert all(m["bloco"] == 30 for m in medicoes)


def test_list_medicoes_ordena_mais_recente_primeiro(client: TestClient):
    first = client.post("/medicoes", json=_payload(observacao="primeira")).json()
    second = client.post("/medicoes", json=_payload(observacao="segunda")).json()

    response = client.get("/medicoes")
    medicoes = response.json()

    assert medicoes[0]["id"] == second["id"]
    assert medicoes[1]["id"] == first["id"]
