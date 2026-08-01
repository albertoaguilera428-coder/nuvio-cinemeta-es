#!/bin/bash
# Script para configurar Nginx y Let's Encrypt (SSL) para tus addons de Stremio

if [ -z "$1" ]; then
  echo "Uso: sudo bash setup-nginx.sh tu-dominio.com"
  exit 1
fi

DOMAIN=$1

echo "=========================================================="
echo " Instalando Nginx y Certbot para el dominio: $DOMAIN..."
echo "=========================================================="

# 1. Instalar Nginx y Certbot
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 2. Crear la configuración del bloque del servidor en Nginx
cat <<EOF | sudo tee /etc/nginx/sites-available/$DOMAIN
server {
    listen 80;
    server_name $DOMAIN;

    # Redirección del Addon Cinemeta en puerto 7000
    location /cinemeta/ {
        proxy_pass http://127.0.0.1:7000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 3. Enlazar la configuración y borrar el sitio por defecto de Nginx
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Verificar configuración y reiniciar Nginx
sudo nginx -t
sudo systemctl restart nginx

echo "=========================================================="
echo " Nginx configurado. Solicitando certificado SSL Let's Encrypt..."
echo "=========================================================="

# 5. Ejecutar Certbot para obtener y configurar SSL automáticamente en Nginx
# Usa --register-unsafely-without-email para hacerlo no interactivo y rápido
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email

# 6. Reiniciar Nginx para recargar con los certificados SSL
sudo systemctl restart nginx

echo "=========================================================="
echo " ¡Dominio y SSL configurados con éxito!"
echo " Tu addon Cinemeta en Español ya es accesible de forma segura en:"
echo " https://$DOMAIN/cinemeta/"
echo "=========================================================="
