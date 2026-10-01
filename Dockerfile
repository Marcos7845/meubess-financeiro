FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4781
ENV HOSTNAME 0.0.0.0
CMD ["npm", "run", "start"]