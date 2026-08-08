"""Popula o banco local com medições fictícias para testar o dashboard.

Gera, para cada combinação de bloco (1 a 40) e espécie, uma "planta" com um
tratamento aleatório e de 1 a 3 medições ao longo do tempo (simulando
crescimento). Regras:

- Altura entre 4 e 13 cm, diâmetro entre 0.9 e 3 mm, crescendo a cada
  medição seguinte da mesma planta.
- A maioria das plantas está viva e com folhas no estado mais recente.
- Sobrevivência não "ressuscita": uma vez morta, as medições seguintes da
  mesma planta continuam mortas.
- Só blocos de 1 a 40 — qualquer medição pré-existente com bloco > 40 é
  removida.

Uso:
    cd backend
    uv run python scripts/seed_dados_ficticios.py
"""

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.enums import Especie, Injuria, Tratamento  # noqa: E402
from app.models import Medicao  # noqa: E402

random.seed(42)

BLOCO_MAX = 40
ALTURA_MIN, ALTURA_MAX = 4.0, 13.0
DIAMETRO_MIN, DIAMETRO_MAX = 0.9, 3.0


def _gerar_medicoes_da_planta(bloco: int, especie: str, tratamento: str) -> list[Medicao]:
    n_medicoes = random.randint(1, 3)
    data = datetime.now(timezone.utc) - timedelta(days=random.randint(60, 150))

    altura = round(random.uniform(ALTURA_MIN, ALTURA_MIN + 3), 1)
    diametro1 = round(random.uniform(DIAMETRO_MIN, DIAMETRO_MIN + 0.6), 2)
    viva = random.random() < 0.97
    medicoes = []

    for _ in range(n_medicoes):
        if viva:
            altura = round(min(altura + random.uniform(0.3, 1.5), ALTURA_MAX), 1)
            diametro1 = round(min(diametro1 + random.uniform(0.05, 0.3), DIAMETRO_MAX), 2)
            # ~6% de chance de morrer a cada nova medição; morte não se reverte.
            viva = random.random() >= 0.06

        diametro2 = (
            round(diametro1 + random.uniform(-0.1, 0.1), 2)
            if random.random() < 0.15
            else None
        )
        if diametro2 is not None:
            diametro2 = max(DIAMETRO_MIN, min(diametro2, DIAMETRO_MAX))

        tem_folhas = random.random() < (0.9 if viva else 0.15)
        tem_daninha = random.random() < 0.35

        injurias: list[str] = []
        if random.random() < 0.25:
            injurias = random.sample(list(Injuria), k=random.choice([1, 1, 2]))
            injurias = [i.value for i in injurias]

        medicoes.append(
            Medicao(
                bloco=bloco,
                especie=especie,
                tratamento=tratamento,
                altura=altura,
                diametro1=diametro1,
                diametro2=diametro2,
                tem_folhas=tem_folhas,
                viva=viva,
                tem_daninha=tem_daninha,
                injurias=injurias,
                observacao=None,
                data_medicao=data,
            )
        )
        data = data + timedelta(days=random.randint(7, 21))
        if data > datetime.now(timezone.utc):
            break

    return medicoes


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        removidas = db.query(Medicao).filter(Medicao.bloco > BLOCO_MAX).delete()
        if removidas:
            print(f"Removidas {removidas} medições com bloco > {BLOCO_MAX}.")

        novas: list[Medicao] = []
        for bloco in range(1, BLOCO_MAX + 1):
            for especie in Especie:
                tratamento = random.choice(list(Tratamento))
                novas.extend(_gerar_medicoes_da_planta(bloco, especie.value, tratamento.value))

        db.add_all(novas)
        db.commit()
        print(f"Inseridas {len(novas)} medições fictícias (blocos 1-{BLOCO_MAX}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
