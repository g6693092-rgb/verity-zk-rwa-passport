# UI Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY ui/package*.json ./
RUN npm install --production

COPY ui .

EXPOSE 3001

CMD ["npm", "start"]
