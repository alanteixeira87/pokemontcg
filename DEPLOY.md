# Deploy em hospedagem

Este projeto pode ser publicado com:

- Frontend: Vercel
- Backend: Render
- Banco: PostgreSQL no Render

## 1. Subir o codigo para o GitHub

Crie um repositorio no GitHub e envie a pasta `Pokemon 2`.

## 2. Backend no Render

1. Acesse Render.
2. Crie um novo `Web Service`.
3. Conecte o repositorio.
4. Configure:

```text
Root Directory: backend
Build Command: npm install --include=dev && npm run prisma:generate && npm run build && npm run prisma:deploy
Start Command: npm start
Health Check Path: /health
```

Variaveis:

```text
NODE_ENV=production
DATABASE_URL=postgresql://...
POKEMON_TCG_API_URL=https://api.pokemontcg.io/v2
POKEMON_TCG_API_KEY=
POKEWALLET_API_URL=https://api.pokewallet.io
POKEWALLET_API_KEY=sua-chave-pokewallet
FRONTEND_URL=https://sua-url-da-vercel.vercel.app
JWT_SECRET=uma-chave-grande-e-secreta
```

Crie um banco PostgreSQL no Render e use a `Internal Database URL` como `DATABASE_URL`.

## 3. Frontend na Vercel

1. Acesse Vercel.
2. Importe o mesmo repositorio.
3. Configure:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Variavel:

```text
VITE_API_URL=https://sua-api-no-render.onrender.com/api
```

Depois do deploy do frontend, volte ao Render e atualize:

```text
FRONTEND_URL=https://sua-url-da-vercel.vercel.app
```

Mantenha `JWT_SECRET` fixo. Se trocar esse valor, os usuarios precisarão fazer login novamente.

## 4. Validar

Backend:

```text
https://sua-api-no-render.onrender.com/health
https://sua-api-no-render.onrender.com/api/cards?page=1&pageSize=3&search=charizard
```

Frontend:

```text
https://sua-url-da-vercel.vercel.app
```

## Observacao

Render deixa o backend dormir após um período sem tráfego no plano gratuito. A primeira busca precisa despertar a instância e pode levar cerca de um minuto. Para eliminar essa espera, use uma instância paga sempre ativa.
