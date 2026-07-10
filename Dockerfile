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

CMD ["node", "build/index.js"]

