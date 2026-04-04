# Use lightweight Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy app code
COPY . .

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "server.js"]