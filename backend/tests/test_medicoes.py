import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Medicao


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
    # `response.text` mantém o BOM como primeiro caractere; um leitor de
    # CSV de verdade (Excel, `open(..., encoding="utf-8-sig")`) descarta
    # ele sozinho antes de interpretar o cabeçalho.
    texto = response.text.lstrip(chr(0xFEFF))
    return list(csv.DictReader(io.StringIO(texto)))


def _medicao_em(db: Session, data_medicao: datetime, **overrides) -> Medicao:
    payload = _payload()
    payload.update(overrides)
    medicao = Medicao(
        bloco=payload["bloco"],
        especie=payload["especie"],
        tratamento=payload["tratamento"],
        altura=payload["altura"],
        diametro1=payload["diametro1"],
        diametro2=payload["diametro2"],
        tem_folhas=payload["tem_folhas"],
        viva=payload["viva"],
        tem_daninha=payload["tem_daninha"],
        injurias=payload["injurias"],
        observacao=payload["observacao"],
        data_medicao=data_medicao,
    )
    db.add(medicao)
    db.commit()
    return medicao


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


def test_export_inclui_bom_utf8_pro_excel_nao_corromper_acentos(client: TestClient):
    response = client.get("/medicoes/export")
    assert response.text.startswith(chr(0xFEFF))
    assert response.content.startswith(b"\xef\xbb\xbf")


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


def test_export_filtra_por_dia(client: TestClient, db_session: Session):
    dia_alvo = datetime(2026, 3, 10, 14, 30, tzinfo=timezone.utc)
    _medicao_em(db_session, dia_alvo, bloco=1)
    _medicao_em(db_session, dia_alvo + timedelta(hours=8), bloco=2)  # mesmo dia, outra hora
    _medicao_em(db_session, dia_alvo - timedelta(days=1), bloco=3)  # véspera
    _medicao_em(db_session, dia_alvo + timedelta(days=1), bloco=4)  # dia seguinte

    response = client.get("/medicoes/export", params={"data": "2026-03-10"})
    rows = _rows(response)

    assert {r["Bloco"] for r in rows} == {"1", "2"}


def test_create_medicao_rejeita_tratamento_que_nao_existe(client: TestClient):
    # o experimento vai de T0 a T8: T9 não existe
    assert client.post("/medicoes", json=_payload(tratamento="T9")).status_code == 422
    assert client.post("/medicoes", json=_payload(tratamento="T8")).status_code == 201


def test_delete_medicao_remove_so_a_medicao_pedida(client: TestClient):
    primeira = client.post("/medicoes", json=_payload(bloco=1)).json()
    segunda = client.post("/medicoes", json=_payload(bloco=2)).json()

    response = client.delete(f"/medicoes/{primeira['id']}")

    assert response.status_code == 204
    restantes = client.get("/medicoes").json()
    assert [m["id"] for m in restantes] == [segunda["id"]]


def test_delete_medicao_inexistente_devolve_404(client: TestClient):
    response = client.delete("/medicoes/999")
    assert response.status_code == 404

    # e uma medição já excluída não pode ser excluída de novo
    criada = client.post("/medicoes", json=_payload()).json()
    assert client.delete(f"/medicoes/{criada['id']}").status_code == 204
    assert client.delete(f"/medicoes/{criada['id']}").status_code == 404


def test_tabela_pagina_do_mais_recente_pro_mais_antigo(client: TestClient):
    ids = [client.post("/medicoes", json=_payload(bloco=b)).json()["id"] for b in range(1, 6)]

    pagina1 = client.get("/medicoes/tabela", params={"por_pagina": 2}).json()
    pagina3 = client.get("/medicoes/tabela", params={"por_pagina": 2, "pagina": 3}).json()
    alem = client.get("/medicoes/tabela", params={"por_pagina": 2, "pagina": 4}).json()

    assert [m["id"] for m in pagina1["itens"]] == [ids[4], ids[3]]  # as mais novas primeiro
    assert pagina1["total"] == 5
    assert pagina1["total_paginas"] == 3
    assert pagina1["pagina"] == 1 and pagina1["por_pagina"] == 2
    assert [m["id"] for m in pagina3["itens"]] == [ids[0]]  # sobrou uma na última página
    assert alem["itens"] == []  # além do fim: lista vazia, não erro
    assert alem["total"] == 5


def test_tabela_filtra_por_bloco_especie_e_tratamento(client: TestClient):
    client.post("/medicoes", json=_payload(bloco=1, especie="MB", tratamento="T1"))
    client.post("/medicoes", json=_payload(bloco=1, especie="CF", tratamento="T1"))
    client.post("/medicoes", json=_payload(bloco=2, especie="MB", tratamento="T1"))
    client.post("/medicoes", json=_payload(bloco=2, especie="MB", tratamento="T2"))

    def total(**filtros):
        return client.get("/medicoes/tabela", params=filtros).json()["total"]

    assert total() == 4
    assert total(bloco=1) == 2
    assert total(especie="MB") == 3
    assert total(tratamento="T1") == 3
    assert total(bloco=2, especie="MB", tratamento="T2") == 1
    assert total(bloco=3) == 0
    # o total acompanha o filtro, e a paginação também
    filtrado = client.get("/medicoes/tabela", params={"bloco": 1, "por_pagina": 1}).json()
    assert filtrado["total"] == 2 and filtrado["total_paginas"] == 2 and len(filtrado["itens"]) == 1


def test_tabela_sem_medicoes_tem_uma_pagina_vazia(client: TestClient):
    body = client.get("/medicoes/tabela").json()
    assert body["itens"] == [] and body["total"] == 0 and body["total_paginas"] == 1


def test_tabela_valida_os_parametros(client: TestClient):
    assert client.get("/medicoes/tabela", params={"pagina": 0}).status_code == 422
    assert client.get("/medicoes/tabela", params={"por_pagina": 0}).status_code == 422
    assert client.get("/medicoes/tabela", params={"por_pagina": 201}).status_code == 422
    assert client.get("/medicoes/tabela", params={"tratamento": "T9"}).status_code == 422
