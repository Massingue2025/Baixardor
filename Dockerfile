FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg curl && apt-get clean

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["python", "app.py"]
