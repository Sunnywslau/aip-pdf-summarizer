FROM python:3.11-slim

# Install system dependencies needed by PyMuPDF if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose default port for Hugging Face Spaces
EXPOSE 7860
ENV PORT=7860

CMD ["python", "app.py"]
