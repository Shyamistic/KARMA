FROM node:20-slim

WORKDIR /app

# Install system dependencies for Prisma (Debian-slim)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma Client (uses schema in ./prisma/schema.prisma)
RUN npx prisma generate --schema=prisma/schema.prisma

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
