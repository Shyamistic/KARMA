FROM node:18-alpine

WORKDIR /app

# Install system dependencies for Prisma/SQLite
RUN apk add --no-cache openssl

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
