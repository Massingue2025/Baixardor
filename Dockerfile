# Usa uma imagem Node.js oficial com suporte a ffmpeg e Chromium
FROM node:20-slim

# Instala o FFmpeg e dependências do Puppeteer
RUN apt-get update && apt-get install -y \
  ffmpeg \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Cria diretório da app
WORKDIR /app

# Copia arquivos do projeto
COPY package*.json ./
RUN npm install

COPY . .

# Expondo porta
EXPOSE 3000

# Início do servidor
CMD ["node", "server.js"]

