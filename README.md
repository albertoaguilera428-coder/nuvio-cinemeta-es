# Cinemeta en Español (Nuvio & Stremio)

Este addon de metadatos traduce automáticamente los catálogos y sinopsis de películas y series en español, integrándose con **The Movie Database (TMDB)** y haciéndolos 100% compatibles con Nuvio y Stremio (empleando IDs de IMDb para resolver enlaces de streaming).

---

## 🚀 Despliegue en 1 Clic en DigitalOcean

Haz clic en el siguiente botón para desplegar tu propia instancia totalmente administrada y con HTTPS automático en **DigitalOcean App Platform**:

[![Deploy to DO](https://www.digitalocean.com/api/static-content/v1/images?src=https%3A%2F%2Fwww.deploytodo.com%2Fdo-btn-blue.svg&token=17b950890e7051c2a16c7739bad4f6d69e7773367b41d7b10e0e33a42a3e75b4)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/albertoaguilera428-coder/nuvio-cinemeta-es/tree/main)

*Nota: La configuración del servidor, puertos e instancias ya está pre-definida en el archivo `.do/deploy.template.yaml`.*

---

## 🛠️ Ejecución Local

Si prefieres correrlo en tu máquina local:

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Entra en tu navegador a [http://localhost:7000](http://localhost:7000) para configurarlo.

---

## ⚙️ Estructura del Proyecto

*   `server.js`: El servidor Express que implementa el protocolo de Stremio.
*   `tmdb.js`: Módulo de conexión a la API de TMDB con traducción e indexación local.
*   `index.html`: Panel web visual para configuración rápida.
*   `cache.json`: Almacenamiento local automatizado de mappings de IDs de IMDb <-> TMDB.
*   `app.yaml` y `.do/deploy.template.yaml`: Archivos de configuración para el despliegue en DigitalOcean.
