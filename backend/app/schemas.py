from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.enums import Especie, Injuria, Tratamento


def _round_altura(v: float | None) -> float | None:
    return v if v is None else round(v, 1)


def _round_diametro(v: float | None) -> float | None:
    return v if v is None else round(v, 2)


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
    def _valida_altura(cls, v: float | None) -> float | None:
        return _round_altura(v)

    @field_validator("diametro1", "diametro2")
    @classmethod
    def _valida_diametro(cls, v: float | None) -> float | None:
        return _round_diametro(v)


class MedicaoRead(MedicaoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data_medicao: datetime


class SessaoCreate(BaseModel):
    bloco: int


class SessaoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bloco: int
    criada_em: datetime
    finalizada_em: datetime | None
    total_plantas: int
    total_completas: int


class SessaoPlantaCreate(BaseModel):
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
    def _valida_altura(cls, v: float | None) -> float | None:
        return _round_altura(v)

    @field_validator("diametro1", "diametro2")
    @classmethod
    def _valida_diametro(cls, v: float | None) -> float | None:
        return _round_diametro(v)


class SessaoPlantaUpdate(BaseModel):
    especie: Especie | None = None
    tratamento: Tratamento | None = None
    altura: float | None = None
    diametro1: float | None = None
    diametro2: float | None = None
    tem_folhas: bool | None = None
    viva: bool | None = None
    tem_daninha: bool | None = None
    injurias: list[Injuria] | None = None
    observacao: str | None = None

    @field_validator("altura")
    @classmethod
    def _valida_altura(cls, v: float | None) -> float | None:
        return _round_altura(v)

    @field_validator("diametro1", "diametro2")
    @classmethod
    def _valida_diametro(cls, v: float | None) -> float | None:
        return _round_diametro(v)


class SessaoPlantaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    especie: Especie
    tratamento: Tratamento
    altura: float | None
    diametro1: float | None
    diametro2: float | None
    tem_folhas: bool
    viva: bool
    tem_daninha: bool
    injurias: list[Injuria]
    observacao: str | None
    criada_em: datetime
    diametro_preenchido_em: datetime | None
    completa: bool


class SessaoDetalhe(SessaoRead):
    plantas: list[SessaoPlantaRead]


class ResumoDashboard(BaseModel):
    total_plantas: int
    total_mortas: int
    total_vivas: int
    percentual_mortas: float


class MortalidadePorTratamento(BaseModel):
    tratamento: Tratamento
    mortas: int
    percentual: float


class MortalidadePorBloco(BaseModel):
    bloco: int
    mortas: int
    percentual: float


class ContagemInjuria(BaseModel):
    injuria: Injuria
    contagem: int


class DiametroPorTratamento(BaseModel):
    tratamento: Tratamento
    diametro_medio: float
    n: int


class AlturaPorTratamento(BaseModel):
    tratamento: Tratamento
    altura_media: float
    n: int


class PontoEvolucaoTratamento(BaseModel):
    tratamento: Tratamento
    periodo: str
    altura_media: float | None
    diametro_medio: float | None
    percentual_mortas_acumulado: float


class PontoEvolucaoBloco(BaseModel):
    bloco: int
    periodo: str
    altura_media: float | None
    diametro_medio: float | None
    percentual_mortas_acumulado: float


class BlocoPorCrescimento(BaseModel):
    bloco: int
    posicao: Literal["maior", "75%", "mediana", "25%", "menor"]
    taxa_altura: float | None
    taxa_diametro: float | None
    score: float
