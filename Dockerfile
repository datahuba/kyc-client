FROM node:20-alpine

WORKDIR /app

# Vite variables are required at build time for client bundle replacement
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "build/index.js"]

