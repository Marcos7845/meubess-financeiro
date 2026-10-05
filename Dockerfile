FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# `npm run servidor` (scripts/subir-servidor.mjs) sobe em 0.0.0.0, na porta de $PORT, COM LOGIN.
# Nunca `npm run start`: ele desliga o login e só atende 127.0.0.1.
# Este CMD também mantém o login quando a imagem é iniciada sem startCommand externo.
CMD ["npm", "run", "servidor"]
