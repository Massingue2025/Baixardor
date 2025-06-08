# Usa imagem oficial Node.js slim (menos pesada)
FROM node:20-slim

# Atualiza repositórios e instala ffmpeg + todas libs necessárias para Chromium rodar Puppeteer
RUN apt-get update && apt-get install -y \
    ffmpeg \                      # FFmpeg para streaming do vídeo
    wget \                       # Ferramenta para baixar arquivos, necessária em alguns casos
    ca-certificates \            # Certificados SSL para HTTPS
    fonts-liberation \           # Fontes para renderização no Chromium
    libappindicator3-1 \         # Biblioteca para indicadores de apps
    libasound2 \                 # Áudio
    libatk-bridge2.0-0 \         # Acessibilidade do GTK
    libatk1.0-0 \                # Biblioteca para GTK
    libcups2 \                   # Sistema de impressão
    libdbus-1-3 \                # D-Bus IPC
    libxcomposite1 \             # Extensão X para compor janelas
    libxdamage1 \                # Extensão X para danos na tela
    libxrandr2 \                 # Extensão X para redimensionar janelas
    libnss3 \                   # Biblioteca de segurança (ESSENCIAL para Chromium)
    libgconf-2-4 \               # Configurações GTK
    libglib2.0-0 \               # Biblioteca GLib
    libgtk-3-0 \                 # GTK v3 (interface gráfica)
    libnspr4 \                   # Suporte ao runtime
    libpango-1.0-0 \             # Renderização de texto
    libx11-6 \                   # X11 básico
    libx11-xcb1 \                # Extensão X11
    libxcb1 \                    # Protocolo X
    libxcursor1 \                # Cursor X
    libxfixes3 \                 # Fixes para X
    libxi6 \                    # X Input
    libxrender1 \                # Renderização X
    libxss1 \                   # Extensão de proteção de tela
    libxtst6 \                  # Extensão de teste X
    lsb-release \               # Informações do SO
    xdg-utils \                 # Utilitários para desktop
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Diretório da aplicação dentro do container
WORKDIR /app

# Copia package.json e package-lock.json para instalação de dependências
COPY package*.json ./

# Instala as dependências Node.js (incluindo puppeteer, express, multer, cors, etc)
RUN npm install

# Copia o restante dos arquivos da aplicação para o container
COPY . .

# Expõe a porta 3000 para acesso externo
EXPOSE 3000

# Comando para iniciar a aplicação Node.js
CMD ["node", "server.js"]
