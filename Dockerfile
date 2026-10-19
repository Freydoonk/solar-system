# Dockerfile
FROM node:25-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Vite dev server
EXPOSE 5173

# Important for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
