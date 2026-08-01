#!/bin/bash
# Script de configuración automatizada para el servidor de Addons de Stremio en AWS EC2 (Ubuntu)

echo "=========================================================="
echo " Iniciando instalación del servidor de addons de Stremio..."
echo "=========================================================="

# 1. Actualizar repositorios del sistema
sudo apt-get update -y

# 2. Instalar dependencias requeridas (curl, git)
sudo apt-get install -y curl git

# 3. Descargar e instalar la versión LTS de Node.js (v22 / v24)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versiones instaladas
node -v
npm -v

# 4. Instalar PM2 (Process Manager) globalmente
sudo npm install pm2 -g

# 5. Clonar el repositorio del addon de Cinemeta
git clone https://github.com/albertoaguilera428-coder/nuvio-cinemeta-es.git
cd nuvio-cinemeta-es

# 6. Instalar las dependencias de producción
npm install --production

# 7. Levantar el addon usando el archivo de configuración de PM2
pm2 start ecosystem.config.cjs

# 8. Configurar PM2 para auto-inicio tras reinicios del servidor
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "=========================================================="
echo " ¡Servidor configurado con éxito!"
echo " Tu addon 'Cinemeta en Español' está corriendo en el puerto 7000."
echo " Recuerda abrir el puerto 7000 en el Security Group de AWS."
echo "=========================================================="
