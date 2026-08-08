from enum import Enum


class Especie(str, Enum):
    CF = "CF"
    CV = "CV"
    CS = "CS"
    ED = "ED"
    ES = "ES"
    MB = "MB"
    MC = "MC"
    MF = "MF"
    MH = "MH"
    MG = "MG"
    JP = "JP"
    ST = "ST"
    SG = "SG"


class Tratamento(str, Enum):
    T0 = "T0"
    T1 = "T1"
    T2 = "T2"
    T3 = "T3"
    T4 = "T4"
    T5 = "T5"
    T6 = "T6"
    T7 = "T7"
    T8 = "T8"
    T9 = "T9"


class Injuria(str, Enum):
    A = "A"
    AA = "AA"
    APC = "APC"
    FS = "FS"
    FM = "FM"
    H = "H"
    P = "P"
