FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Uploaded files and the embedded Qdrant store live here; mounted as a volume
# by compose so they survive a rebuild.
RUN mkdir -p assets/files assets/database

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
