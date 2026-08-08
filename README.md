# mudas-biochar

Webapp para digitalizar as medições de uma pesquisa de biologia (mudas/biochar), substituindo o registro em papel/planilha por um cadastro direto em banco de dados, com geração de relatórios filtrados e um dashboard.

## Domínio: o que é uma medição

Cada medição registrada tem os campos abaixo, nesta ordem:

| Campo | Tipo | Observações |
|---|---|---|
| Bloco | inteiro | identifica o bloco da planta |
| Espécie | enum | `CF, CV, CS, ED, ES, MB, MC, MF, MH, MG, JP, ST, SG` |
| Tratamento | enum | `T0` a `T9` |
| Altura | float (1 casa decimal), opcional | cm, ex. `11.9`; pode ser `NA` |
| Diâmetro 1 | float (2 casas decimais), opcional | mm, ex. `1.96`; pode ser `NA` |
| Diâmetro 2 | float (2 casas decimais), opcional | mm; preenchido só quando o caule é quadrado (2 medidas de diâmetro). Se o caule for normal (redondo), fica `NA` |
| Folhas | binário | 1 = tem folhas, 0 = não tem |
| Sobrevivência | binário | 1 = viva, 0 = morta |
| Daninha | binário | 1 = tem daninha, 0 = não tem |
| Injúria | enum (múltipla escolha), opcional | `A, AA, APC, FS, FM, H, P` — uma medição pode ter mais de uma ou nenhuma |
| Observação | texto | opcional |
| Data da medição | datetime | preenchida automaticamente |

## Páginas planejadas

1. **Cadastro** (principal) — formulário para lançar uma medição rapidamente em campo/laboratório. Layout pensado primeiro para celular/tablet na vertical, já que é onde o formulário será usado na prática.
2. **Relatório** — duas seções: **Dados** (filtros opcionais e combináveis — bloco, tratamento, espécie, folhas, sobrevivência, daninha, presença de injúria — e download em CSV) e **Diferenças** (comparar medições de uma mesma planta ao longo do tempo; ainda a definir).
3. **Dashboard** — visão geral dos dados, em duas partes:
   - **Estado atual** (baseado na medição mais recente de cada planta — se ela morreu, conta como morta mesmo com medições anteriores vivas): % de mortalidade por tratamento, contagem de injúrias, e diâmetro médio por tratamento para uma espécie escolhida.
   - **Evolução ao longo do tempo** (usa todas as medições, agrupadas por mês): altura média, diâmetro médio e % de mortalidade acumulada por tratamento, e a taxa de mortalidade de cada tipo de injúria comparada à taxa geral.

Há também uma planilha com medições já coletadas anteriormente, que precisa ser importada para o banco na primeira carga (ver `data/`).

### Medições repetidas ao longo do tempo

Uma mesma planta (identificada pela combinação Bloco + Espécie + Tratamento) é medida várias vezes ao longo do tempo, para permitir comparar a evolução dessa planta entre medições. Isso significa que o banco guarda um **histórico de medições**, não um cadastro único por planta — cada lançamento no cadastro é uma nova medição (com sua própria data), não uma edição da anterior.

## Estrutura do repositório

```
frontend/   interface web (cadastro, relatório, dashboard)
backend/    API e persistência dos dados
data/       planilha(s) originais e scripts de importação
```

Backend em FastAPI, frontend em React + Vite. Um requisito de projeto é **custo zero de hospedagem/infra**: Postgres gerenciado no Supabase (free tier) e frontend estático em Vercel/Netlify/Cloudflare Pages.

## Rodando localmente

Backend (API):

```
cd backend
uv run uvicorn app.main:app --reload
```

Frontend:

```
cd frontend
npm run dev
```

Os dois precisam rodar ao mesmo tempo (terminais separados). Veja `backend/README.md` e `frontend/README.md` para detalhes.
