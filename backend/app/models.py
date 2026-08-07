from datetime import datetime, timezone

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Medicao(Base):
    """Um evento de medição de uma planta.

    Uma planta é identificada pela combinação (bloco, especie, tratamento) e é
    medida várias vezes ao longo do tempo — cada linha aqui é uma dessas
    medições, diferenciadas por `data_medicao`.
    """

    __tablename__ = "medicoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    bloco: Mapped[int]
    especie: Mapped[str] = mapped_column(String(2))
    tratamento: Mapped[str] = mapped_column(String(2))
    altura: Mapped[float | None]
    diametro1: Mapped[float | None]
    diametro2: Mapped[float | None]
    tem_folhas: Mapped[bool]
    viva: Mapped[bool]
    tem_daninha: Mapped[bool]
    injurias: Mapped[list[str]] = mapped_column(JSON, default=list)
    observacao: Mapped[str | None]
    data_medicao: Mapped[datetime] = mapped_column(default=_now_utc)
