# バックエンド（FastAPI）用Dockerfile
FROM python:3.9-slim

WORKDIR /app

# 依存関係をコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY . .

# ポート8880を公開
EXPOSE 8880

# アプリケーションを起動
CMD ["python", "main.py"]
