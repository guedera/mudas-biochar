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
