FROM python:3.11-slim

WORKDIR /app

# CPU-only torch build, installed separately from an index that only serves
# CPU wheels — pulling it from regular PyPI drags in ~2GB of unused CUDA
# libraries since this container has no GPU access anyway.
RUN pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV MODEL_NAME=all-MiniLM-L6-v2
EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
