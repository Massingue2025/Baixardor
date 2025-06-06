from flask import Flask, request, render_template, send_file
import yt_dlp
import os
import tempfile
import asyncio
import uuid
from playwright.async_api import async_playwright
import requests

app = Flask(__name__)
download_cache = {}

def baixar_com_yt_dlp(url):
    tmp_dir = tempfile.mkdtemp()
    output_path = os.path.join(tmp_dir, 'video.%(ext)s')

    ydl_opts = {
        'format': 'best',
        'outtmpl': output_path,
        'noplaylist': True,
        'quiet': True,
        'geo_bypass': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        file_path = ydl.prepare_filename(info)

    return file_path

async def extrair_link_video(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=90000, wait_until='networkidle')

        try:
            await page.wait_for_function(
                """() => {
                    const html = document.documentElement.innerHTML;
                    return html.includes('.mp4') || html.includes('.m3u8') || html.includes('.webm');
                }""",
                timeout=30000
            )
        except Exception as e:
            print("Timeout esperando vídeo no HTML via JS:", e)

        video_urls = set()

        for tag in ['video', 'source']:
            elements = await page.query_selector_all(tag)
            for el in elements:
                src = await el.get_attribute('src')
                if src and src.startswith("http"):
                    video_urls.add(src)

        html = await page.content()
        for ext in ['.mp4', '.m3u8', '.webm', '.mov', '.flv', '.ts', '.ogg']:
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
                file_path = baixar_com_yt_dlp(video_url)
                download_id = str(uuid.uuid4())
                download_cache[download_id] = file_path
            except Exception as e_dl:
                print("Erro yt-dlp:", str(e_dl))
                try:
                    links = asyncio.run(extrair_link_video(video_url))
                    if not links:
                        error = "Não foi possível encontrar vídeo na página."
                    else:
                        link_final = links[0]
                        response = requests.get(link_final, stream=True)
                        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                tmp_file.write(chunk)
                        tmp_file.close()
                        download_id = str(uuid.uuid4())
                        download_cache[download_id] = tmp_file.name
                except Exception as e_browser:
                    print("Erro navegador:", str(e_browser))
                    error = "Falha ao baixar com navegador invisível."

    return render_template('index.html', error=error, download_id=download_id)

@app.route('/download/<download_id>')
def download_file(download_id):
    file_path = download_cache.get(download_id)
    if file_path and os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "Arquivo expirado ou não encontrado.", 404

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
