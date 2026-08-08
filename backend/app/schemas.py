from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.enums import Especie, Injuria, Tratamento


class MedicaoCreate(BaseModel):
    bloco: int
    especie: Especie
    tratamento: Tratamento
    altura: float | None = None
    diametro1: float | None = None
    diametro2: float | None = None
    tem_folhas: bool
    viva: bool
    tem_daninha: bool
    injurias: list[Injuria] = []
    observacao: str | None = None

    @field_validator("altura")
    @classmethod
    def _round_altura(cls, v: float | None) -> float | None:
        return v if v is None else round(v, 1)

    @field_validator("diametro1", "diametro2")
    @classmethod
    def _round_diametro(cls, v: float | None) -> float | None:
        return v if v is None else round(v, 2)


class MedicaoRead(MedicaoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data_medicao: datetime


class ResumoDashboard(BaseModel):
    total_plantas: int
    total_mortas: int
    total_vivas: int
    percentual_mortas: float


class MortalidadePorTratamento(BaseModel):
    tratamento: Tratamento
    mortas: int
    percentual: float


class ContagemInjuria(BaseModel):
    injuria: Injuria
    contagem: int


class DiametroPorTratamento(BaseModel):
    tratamento: Tratamento
    diametro_medio: float
    n: int


class PontoEvolucaoTratamento(BaseModel):
    tratamento: Tratamento
    periodo: str
    altura_media: float | None
    diametro_medio: float | None
    percentual_mortas_acumulado: float


class InjuriaVsSobrevivencia(BaseModel):
    injuria: Injuria
    n: int
    taxa_mortalidade: float
    delta: float
