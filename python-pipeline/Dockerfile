FROM python:3.11-slim

# Install system dependencies, specifically ffmpeg for video processing
RUN apt-get update && \
    apt-get install -y ffmpeg && \
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
