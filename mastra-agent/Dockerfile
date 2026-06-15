FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000
EXPOSE 5678

CMD ["npm", "run", "dev"]
