FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema: ffmpeg, curl e libs necessárias para playwright
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxss1 \
    libxshmfence1 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libxkbcommon0 \
    libwayland-client0 \
    libwayland-cursor0 \
    libwayland-egl1 \
    libepoxy0 \
    libdbus-1-3 \
    libatspi2.0-0 \
    libxcb-dri3-0 \
    libxcb1 \
    libxcb-render0 \
    libxcb-shm0 \
    libxdamage1 \
    libxfixes3 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instalar browsers do playwright
RUN playwright install chromium

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
