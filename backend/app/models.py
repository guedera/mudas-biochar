from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class Sessao(Base):
    """Uma sessão de coleta em campo, referente a um único bloco.

    Rascunho isolado: as `SessaoPlanta` daqui só viram `Medicao` de verdade
    quando a sessão é finalizada (ver `POST /sessoes/{id}/finalizar`).
    """

    __tablename__ = "sessoes"

    id: Mapped[int] = mapped_column(primary_key=True)
    bloco: Mapped[int]
    criada_em: Mapped[datetime] = mapped_column(default=_now_utc)
    finalizada_em: Mapped[datetime | None] = mapped_column(default=None)

    plantas: Mapped[list["SessaoPlanta"]] = relationship(
        back_populates="sessao",
        cascade="all, delete-orphan",
        order_by="SessaoPlanta.id",
    )

    @property
    def total_plantas(self) -> int:
        return len(self.plantas)

    @property
    def total_completas(self) -> int:
        return sum(1 for p in self.plantas if p.completa)


class SessaoPlanta(Base):
    """Rascunho de uma planta dentro de uma sessão.

    Fase 1 (em campo, sem diâmetro): especie, tratamento, altura, folhas,
    viva, daninha, injuria. Fase 2 (segunda passada): diametro1/diametro2.
    `criada_em` é o que vira `data_medicao` na `Medicao` definitiva —
    `diametro_preenchido_em` é só para auditoria.
    """

    __tablename__ = "sessao_plantas"

    id: Mapped[int] = mapped_column(primary_key=True)
    sessao_id: Mapped[int] = mapped_column(ForeignKey("sessoes.id"))
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
    criada_em: Mapped[datetime] = mapped_column(default=_now_utc)
    diametro_preenchido_em: Mapped[datetime | None] = mapped_column(default=None)

    sessao: Mapped["Sessao"] = relationship(back_populates="plantas")

    @property
    def completa(self) -> bool:
        return self.altura is not None and self.diametro1 is not None
