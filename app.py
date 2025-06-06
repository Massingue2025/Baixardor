from flask import Flask, request, render_template, send_file, url_for
import yt_dlp
import os
import tempfile
import asyncio
import uuid
from playwright.async_api import async_playwright

app = Flask(__name__)
download_cache = {}  # {id: file path}

def baixar_com_yt_dlp(url):
    tmp_dir = tempfile.mkdtemp()
    ydl_opts = {
        'format': 'best',
        'outtmpl': os.path.join(tmp_dir, 'video.%(ext)s'),
        'noplaylist': True,
        'quiet': True
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        file_path = ydl.prepare_filename(info)

    return file_path

async def extrair_link_video(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=60000)

        # Verifica todos os elementos <video>, <source> e links de vídeo comuns no JS ou HTML
        video_urls = set()

        # 1. Elementos <video> e <source>
        elements = await page.query_selector_all("video, source")
        for el in elements:
            src = await el.get_attribute("src")
            if src and src.startswith("http"):
                video_urls.add(src)

        # 2. Vasculha JS ou HTML por links de vídeo (mp4, m3u8, etc.)
        html = await page.content()
        for ext in [".mp4", ".m3u8", ".webm"]:
            start = 0
            while True:
                idx = html.find(ext, start)
                if idx == -1:
                    break
                start_idx = html.rfind("http", 0, idx)
                if start_idx != -1:
                    link = html[start_idx:idx + len(ext)]
                    video_urls.add(link)
                start = idx + len(ext)

        await browser.close()
        return list(video_urls)

@app.route('/', methods=['GET', 'POST'])
def index():
    video_url = None
    error = None
    download_id = None

    if request.method == 'POST':
        video_url = request.form.get('video_url')

        if not video_url:
            error = "Por favor cole um link de vídeo."
        else:
            try:
                # Tenta com yt-dlp
                file_path = baixar_com_yt_dlp(video_url)
                download_id = str(uuid.uuid4())
                download_cache[download_id] = file_path
            except Exception as e_dl:
                try:
                    # Se yt-dlp falhar, tenta extrair com navegador
                    links = asyncio.run(extrair_link_video(video_url))
                    if not links:
                        error = "Não foi possível encontrar link de vídeo na página."
                    else:
                        # Faz o download manualmente
                        import requests
                        video_stream = requests.get(links[0], stream=True)
                        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
                        for chunk in video_stream.iter_content(chunk_size=8192):
                            if chunk:
                                tmp_file.write(chunk)
                        tmp_file.close()

                        download_id = str(uuid.uuid4())
                        download_cache[download_id] = tmp_file.name
                except Exception as e_browser:
                    error = f"Falha ao baixar vídeo com navegador: {str(e_browser)}"

    return render_template('index.html', error=error, download_id=download_id)

@app.route('/download/<download_id>')
def download_file(download_id):
    file_path = download_cache.get(download_id)
    if file_path and os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "Arquivo não encontrado ou expirado.", 404

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
