from flask import Flask, request, render_template, send_file
import yt_dlp
import os
import tempfile
import asyncio
from playwright.async_api import async_playwright
import requests

app = Flask(__name__)

async def extract_video_link_with_playwright(url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=60000)

        # Tenta pegar src de <video> ou <source>
        video_src = await page.eval_on_selector('video', 'el => el.currentSrc || el.src').catch(lambda _: None)
        if not video_src:
            video_src = await page.eval_on_selector('source', 'el => el.src').catch(lambda _: None)

        await browser.close()
        return video_src

@app.route('/', methods=['GET', 'POST'])
def index():
    video_url = None
    error = None
    if request.method == 'POST':
        video_url = request.form.get('video_url')
        if not video_url:
            error = "Por favor, cole um link de vídeo."
        else:
            try:
                # Tenta baixar com yt-dlp
                tmp_dir = tempfile.mkdtemp()
                ydl_opts = {
                    'format': 'best',
                    'outtmpl': os.path.join(tmp_dir, 'video.%(ext)s'),
                    'noplaylist': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=True)
                    filepath = ydl.prepare_filename(info)

                return send_file(filepath, as_attachment=True, download_name=os.path.basename(filepath))
            except Exception as e:
                # Falhou, tenta com Playwright extrair link direto
                try:
                    video_src = asyncio.run(extract_video_link_with_playwright(video_url))
                    if not video_src:
                        error = "Não foi possível extrair link do vídeo pelo navegador."
                    else:
                        # Baixa vídeo direto do link extraído
                        r = requests.get(video_src, stream=True)
                        tmp_file = tempfile.NamedTemporaryFile(delete=False)
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                tmp_file.write(chunk)
                        tmp_file.close()
                        return send_file(tmp_file.name, as_attachment=True, download_name="video.mp4")
                except Exception as e2:
                    error = f"Falha ao baixar vídeo: {str(e)} | Também falhou extração com navegador: {str(e2)}"

    return render_template('index.html', video_url=video_url, error=error)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
