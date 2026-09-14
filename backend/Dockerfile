FROM node:22-alpine

# ffmpeg provides ffprobe, which the upload validator needs
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install dependencies
# (build tools are only needed if sqlite3 has to compile its native module)
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    npm install --omit=dev && \
    apk del .build-deps

# Copy application code
COPY . .

# Expose port and start server
EXPOSE 5000
CMD ["npm", "start"]
