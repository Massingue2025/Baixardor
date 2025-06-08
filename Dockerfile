# Usa imagem Node.js slim
FROM node:20-slim

# Instala FFmpeg e dependências do Puppeteer
RUN apt-get update && apt-get install -y \
  wget \
  ffmpeg \
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
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Cria diretório da aplicação
WORKDIR /app

# Copia os arquivos
COPY package*.json ./
RUN npm install

COPY . .

# Expõe porta
EXPOSE 3000

# Comando de execução
CMD ["node", "server.js"]
