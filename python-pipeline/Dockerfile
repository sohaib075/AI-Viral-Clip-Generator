FROM python:3.11-slim

# Install system dependencies: ffmpeg for video processing, and fonts for burned-in captions
# (Liberation provides Arial-compatible metrics; DejaVu is the fallback for other styles)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-liberation fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Set environment variables for Flask
# (listen on all interfaces so the backend container can reach it)
ENV PORT=5001
ENV FLASK_HOST=0.0.0.0
EXPOSE 5001

# Start the Flask app
CMD ["python", "app.py"]
