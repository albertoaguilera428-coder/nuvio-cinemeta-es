FROM node:24-alpine

WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install --production

# Copiar el resto del código del proyecto
COPY . .

# Exponer el puerto del servidor
EXPOSE 7000

# Variables de entorno por defecto para producción
ENV PORT=7000
ENV NODE_ENV=production

# Comando de inicio
CMD ["node", "server.js"]
