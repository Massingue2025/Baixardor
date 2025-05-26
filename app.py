from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__)

@app.route('/')
def index():
    return "API Online"

@app.route('/analisar', methods=['POST'])
def analisar():
    data = request.get_json()
    link = data['link']
    res = data['res']
    bitrate = data['bitrate']
    start = data['start']
    end = data['end']
    tempo = int(end) - int(start)

    try:
        ytdlp_cmd = f'yt-dlp -f best --no-playlist -g "{link}"'
        direct_link = subprocess.check_output(ytdlp_cmd, shell=True).decode().strip()

        probe_cmd = f"ffprobe -v error -show_entries format=size -of default=noprint_wrappers=1:nokey=1 \"{direct_link}\""
        original_bytes = float(subprocess.check_output(probe_cmd, shell=True))
        original_mb = round(original_bytes / (1024 * 1024), 2)

        reduzido_bytes = int(bitrate) * 1000 / 8 * tempo
        reduzido_mb = round(reduzido_bytes / (1024 * 1024), 2)

        return jsonify(success=True, direct_link=direct_link, original=original_mb, reduzido=reduzido_mb)

    except Exception as e:
        return jsonify(success=False, error=str(e))


@app.route('/enviar', methods=['POST'])
def enviar():
    data = request.get_json()
    link = data['direct_link']
    res = data['res']
    bitrate = data['bitrate']
    start = data['start']
    end = data['end']
    tempo = int(end) - int(start)

    try:
        ffmpeg_cmd = [
            "ffmpeg",
            "-ss", str(start),
            "-i", link,
            "-t", str(tempo),
            "-vf", f"scale={res}",
            "-b:v", f"{bitrate}k",
            "-f", "mp4",
            "-movflags", "frag_keyframe+empty_moov",
            "pipe:1"
        ]

        curl_cmd = [
            "curl", "-X", "POST", "https://pagarfacil.free.nf/M/receber_vídeo.php",
            "-H", "Content-Type: video/mp4",
            "--data-binary", "@-"
        ]

        ffmpeg = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE)
        curl = subprocess.Popen(curl_cmd, stdin=ffmpeg.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        ffmpeg.stdout.close()
        output, error = curl.communicate()

        return jsonify(success=True, message="Enviado com sucesso!")

    except Exception as e:
        return jsonify(success=False, error=str(e))


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
