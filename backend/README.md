# backend

API em FastAPI para persistência das medições (cadastro, relatórios filtrados, importação da planilha original). Local dev usa SQLite (`medicoes.db`, arquivo gerado ao rodar, não versionado); produção usa Postgres (Supabase).

## Rodando localmente

```
cd backend
uv run uvicorn app.main:app --reload
```

API disponível em `http://127.0.0.1:8000` (docs interativas em `/docs`).

## Testes

```
cd backend
uv run pytest
```

## Endpoints atuais

- `GET /health`
- `POST /medicoes` — cria uma medição.
- `GET /medicoes?bloco=&especie=&tratamento=` — lista medições (mais recentes primeiro); filtrar pelos três campos juntos retorna o histórico de uma planta específica ao longo do tempo.
- `GET /medicoes/blocos` — lista os números de bloco distintos já cadastrados.
- `GET /medicoes/export?...` — baixa um CSV das medições. Todos os filtros são opcionais: `blocos` (repetível, ex. `blocos=5&blocos=10`), `especies` (repetível), `tratamentos` (repetível), `injurias` (repetível), `sem_injuria` (medições sem nenhuma injúria), `tem_folhas`, `viva`, `tem_daninha`. `injurias` e `sem_injuria` se combinam por OR: uma medição entra se tiver pelo menos uma das injúrias marcadas, ou se `sem_injuria=true` e ela não tiver nenhuma.
- `GET /dashboard/resumo` — total de plantas, total mortas/vivas e % de mortalidade geral.
- `GET /dashboard/mortalidade-por-tratamento` — de todas as plantas mortas, % de cada tratamento.
- `GET /dashboard/injurias` — contagem de cada tipo de injúria.
- `GET /dashboard/diametro-por-tratamento?especie=` — diâmetro médio por tratamento, para uma espécie (`especie` obrigatório).
- `GET /dashboard/evolucao` — por tratamento e período (mês, `YYYY-MM`): altura média e diâmetro médio das medições daquele mês, e % de mortalidade acumulada (planta conta como morta a partir do mês da primeira medição em que ela aparece morta; nunca "ressuscita", então esse % nunca cai).
- `GET /dashboard/injuria-vs-sobrevivencia` — para cada tipo de injúria (estado atual), taxa de mortalidade entre quem tem essa injúria e o `delta` em relação à taxa de mortalidade geral.

`resumo`, `mortalidade-por-tratamento`, `injurias` e `diametro-por-tratamento` consideram o **estado atual de cada planta** (bloco+espécie+tratamento): usam só a medição mais recente dela, mesmo que medições anteriores mostrem um estado diferente (ex. viva antes, morta na mais recente = conta como morta). `evolucao` é a exceção: usa todas as medições, agrupadas por mês, pra mostrar a evolução ao longo do tempo.
