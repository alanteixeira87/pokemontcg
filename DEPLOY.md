# Deploy em hospedagem

Este projeto pode ser publicado com:

- Frontend: Vercel
- Backend: Render
- Banco: SQLite em disco persistente no Render

## 1. Subir o codigo para o GitHub

Crie um repositorio no GitHub e envie a pasta `Pokemon 2`.

## 2. Backend no Render

1. Acesse Render.
2. Crie um novo `Web Service`.
3. Conecte o repositorio.
4. Configure:

```text
Root Directory: backend
Build Command: npm install && npm run prisma:generate && npm run build
Start Command: npm start
Health Check Path: /health
```

Variaveis:

```text
NODE_ENV=production
DATABASE_URL=file:/data/dev.db
POKEMON_TCG_API_URL=https://api.pokemontcg.io/v2
POKEMON_TCG_API_KEY=
FRONTEND_URL=https://sua-url-da-vercel.vercel.app
```

Crie um disco persistente:

```text
Mount Path: /data
Size: 1GB
```

Sem disco persistente, o SQLite pode perder dados quando o servidor reiniciar.

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

Render pode deixar o backend dormir no plano gratuito. A primeira busca depois de um tempo pode demorar alguns segundos.
