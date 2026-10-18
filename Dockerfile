# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN chmod +x scripts/run-cold-chain-proof.sh

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
