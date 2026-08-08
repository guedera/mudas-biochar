import csv
import io

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


def _rows(response):
    return list(csv.DictReader(io.StringIO(response.text)))


def test_export_sem_filtros_retorna_tudo(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=10))
    client.post("/medicoes", json=_payload(bloco=20))

    response = client.get("/medicoes/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]

    rows = _rows(response)
    assert len(rows) == 2
    assert set(rows[0].keys()) == {
        "Bloco", "Espécie", "Tratamento", "Altura (cm)", "Diâmetro 1 (mm)",
        "Diâmetro 2 (mm)", "Folhas", "Sobrevivência", "Daninha", "Injúria",
        "Observação", "Data da medição",
    }


def test_export_sem_dados_retorna_so_cabecalho(client: TestClient):
    response = client.get("/medicoes/export")
    assert response.status_code == 200
    assert _rows(response) == []
    assert "Bloco" in response.text


def test_list_blocos_retorna_valores_distintos_ordenados(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=20))
    client.post("/medicoes", json=_payload(bloco=5))
    client.post("/medicoes", json=_payload(bloco=20))

    response = client.get("/medicoes/blocos")
    assert response.status_code == 200
    assert response.json() == [5, 20]


def test_export_filtra_por_multiplos_blocos(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=5))
    client.post("/medicoes", json=_payload(bloco=15))
    client.post("/medicoes", json=_payload(bloco=25))

    response = client.get(
        "/medicoes/export", params=[("blocos", 5), ("blocos", 25)]
    )
    rows = _rows(response)

    assert {r["Bloco"] for r in rows} == {"5", "25"}


def test_export_filtra_por_tipos_de_injuria(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=2, injurias=["AA", "P"]))
    client.post("/medicoes", json=_payload(bloco=3, injurias=[]))

    response = client.get(
        "/medicoes/export", params=[("injurias", "H"), ("injurias", "P")]
    )
    rows = _rows(response)

    assert {r["Bloco"] for r in rows} == {"1", "2"}


def test_export_filtra_por_sem_injuria(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=2, injurias=[]))

    response = client.get("/medicoes/export", params={"sem_injuria": True})
    rows = _rows(response)

    assert [r["Bloco"] for r in rows] == ["2"]


def test_export_combina_injurias_especificas_com_sem_injuria(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, injurias=["H"]))
    client.post("/medicoes", json=_payload(bloco=2, injurias=[]))
    client.post("/medicoes", json=_payload(bloco=3, injurias=["AA"]))

    response = client.get(
        "/medicoes/export", params=[("injurias", "H"), ("sem_injuria", True)]
    )
    rows = _rows(response)

    assert {r["Bloco"] for r in rows} == {"1", "2"}


def test_export_filtra_por_multiplos_tratamentos_e_especies(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T1"))
    client.post("/medicoes", json=_payload(bloco=2, especie="CF", tratamento="T2"))
    client.post("/medicoes", json=_payload(bloco=3, especie="ES", tratamento="T3"))

    response = client.get(
        "/medicoes/export",
        params=[("tratamentos", "T1"), ("tratamentos", "T2"), ("especies", "MB"), ("especies", "CF")],
    )
    rows = _rows(response)

    assert {r["Bloco"] for r in rows} == {"1", "2"}


def test_export_filtra_por_folhas_e_sobrevivencia(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, tem_folhas=False, viva=False))
    client.post("/medicoes", json=_payload(bloco=2, tem_folhas=True, viva=True))

    response = client.get(
        "/medicoes/export", params={"tem_folhas": False, "viva": False}
    )
    rows = _rows(response)

    assert len(rows) == 1
    assert rows[0]["Bloco"] == "1"
    assert rows[0]["Folhas"] == "0"
    assert rows[0]["Sobrevivência"] == "0"
