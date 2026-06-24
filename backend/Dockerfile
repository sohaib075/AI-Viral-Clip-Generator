FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose port and start server
EXPOSE 5000
CMD ["npm", "start"]
