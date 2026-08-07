FROM node:20-alpine

WORKDIR /app

# Vite variables are required at build time for client bundle replacement
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Instala dependencias desde el lockfile (npm ci es más rápido y determinista
# que npm install). Esta capa queda cacheada mientras package*.json no cambie,
# por lo que un cambio solo de código de la app no reinstala dependencias.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# F-FIX-NGINX-CONCURRENCY (2026-08-07, Kevin): server.js arranca 4 workers
# de SvelteKit con SO_REUSEPORT. El kernel de Linux reparte las conexiones
# entrantes entre los workers, dando 4x capacidad. Ver server.js para
# detalles. Por default 4 workers, configurable con WEB_CONCURRENCY.
ENV WEB_CONCURRENCY=4
ENV PORT=3000
CMD ["node", "server.js"]

