# 軽量なPythonイメージを使用
FROM python:3.11-slim

# ワークディレトリを設定
WORKDIR /app

# ログをリアルタイムで表示するための設定
ENV PYTHONUNBUFFERED=1

# 依存関係ファイルをコピーしてインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースコードをコピー
COPY . .

# ワーカーを実行
CMD ["python", "worker.py"]