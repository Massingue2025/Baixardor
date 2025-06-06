from flask import Flask, request, render_template, send_file, redirect, url_for
import yt_dlp
import os
import tempfile
import asyncio
from playwright.async_api import async_playwright
import requests
import uuid

app = Flask(__name__)
download_cache = {}  # Armazena caminhos temporários

async def extract_video_link_with_playwright(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=60000)

        video_src = None
        try:
            video_src = await page.eval_on_selector('video', 'el => el.currentSrc || el.src')
        except:
            pass
        if not video_src:
            try:
                video_src = await page.eval_on_selector('source', 'el => el.src')
            except:
                pass

        await browser.close()
        return video_src

@app.route('/', methods=['GET', 'POST'])
def index():
    video_url = None
    error = None
    download_id = None
    if request.method == 'POST':
        video_url = request.form.get('video_url')
        if not video_url:
            error = "Por favor, cole um link de vídeo."
        else:
            try:
                tmp_dir = tempfile.mkdtemp()
                ydl_opts = {
                    'format': 'best',
                    'outtmpl': os.path.join(tmp_dir, 'video.%(ext)s'),
                    'noplaylist': True,
                    'quiet': True
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=True)
                    filepath = ydl.prepare_filename(info)
                download_id = str(uuid.uuid4())
                download_cache[download_id] = filepath
            except Exception as e:
                try:
                    video_src = asyncio.run(extract_video_link_with_playwright(video_url))
                    if not video_src:
                        error = "Não foi possível extrair o vídeo com navegador invisível."
                    else:
                        r = requests.get(video_src, stream=True)
                        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                tmp_file.write(chunk)
                        tmp_file.close()
                        download_id = str(uuid.uuid4())
                        download_cache[download_id] = tmp_file.name
                except Exception as e2:
                    error = f"Falha ao baixar: {str(e)} | Falha navegador: {str(e2)}"

    return render_template('index.html', video_url=video_url, error=error, download_id=download_id)

@app.route('/download/<download_id>')
def download_file(download_id):
    file_path = download_cache.get(download_id)
    if file_path and os.path.exists(file_path):
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    return "Arquivo não encontrado ou expirado.", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
