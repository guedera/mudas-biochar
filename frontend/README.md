# frontend

Interface web do projeto (React + Vite): página de cadastro de medições, página de relatório (filtros + export CSV/XLS) e dashboard.

## Rodando localmente

```
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. Por padrão fala com a API em `http://127.0.0.1:8000` — para apontar pra outro endereço, copie `.env.example` para `.env` e ajuste `VITE_API_URL`.

Pré-requisito: o `backend` rodando localmente (ver `backend/README.md`).
