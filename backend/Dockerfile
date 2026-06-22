# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/ ./
RUN npm ci && npm run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app
COPY backend/ ./
COPY --from=frontend-builder /frontend/dist /app/static
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
