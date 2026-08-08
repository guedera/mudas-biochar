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
