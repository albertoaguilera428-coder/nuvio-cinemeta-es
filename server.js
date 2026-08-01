import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getMetadata, getCatalog } from './tmdb.js';

// Cargar variables de entorno de .env manualmente si existe
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const parts = line.trim().split('=');
    if (parts.length >= 2 && !parts[0].startsWith('#')) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// Servir la página web de configuración
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Función para generar el manifiesto según la API Key y el idioma
function generateManifest(apiKey, lang = 'es-ES') {
  const isConfigured = !!apiKey;
  const nameSuffix = lang === 'es-MX' ? 'Latino' : 'España';

  return {
    id: 'com.nuvio.cinemeta.es',
    version: '1.0.0',
    name: `Cinemeta en Español (${nameSuffix})`,
    description: 'Películas y Series con metadatos y catálogos en Español de TMDB.',
    logo: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=256&h=256&fit=crop',
    resources: isConfigured ? ['catalog', 'meta'] : [],
    types: ['movie', 'series'],
    catalogs: isConfigured ? [
      {
        id: 'tmdb_popular',
        type: 'movie',
        name: `Cine: Populares (${nameSuffix})`,
        extra: [{ name: 'skip' }]
      },
      {
        id: 'tmdb_top_rated',
        type: 'movie',
        name: `Cine: Mejor Valoradas (${nameSuffix})`,
        extra: [{ name: 'skip' }]
      },
      {
        id: 'tmdb_popular',
        type: 'series',
        name: `Series: Populares (${nameSuffix})`,
        extra: [{ name: 'skip' }]
      },
      {
        id: 'tmdb_top_rated',
        type: 'series',
        name: `Series: Mejor Valoradas (${nameSuffix})`,
        extra: [{ name: 'skip' }]
      }
    ] : [],
    behaviorHints: {
      configurable: true,
      configurationRequired: !isConfigured
    }
  };
}

// Ruta para el manifiesto por defecto (puede usar el del .env si existe)
app.get('/manifest.json', (req, res) => {
  const defaultApiKey = process.env.TMDB_API_KEY;
  const defaultLang = process.env.DEFAULT_LANG || 'es-ES';
  res.json(generateManifest(defaultApiKey, defaultLang));
});

// Manifiesto con API Key y lenguaje opcional
app.get('/:apiKey/manifest.json', (req, res) => {
  res.json(generateManifest(req.params.apiKey, 'es-ES'));
});

app.get('/:apiKey/:lang/manifest.json', (req, res) => {
  res.json(generateManifest(req.params.apiKey, req.params.lang));
});

// Helper para parsear el parámetro "extra"
function getPageFromExtra(extra) {
  if (!extra) return 1;
  const cleanExtra = extra.replace('.json', '');
  const params = new URLSearchParams(cleanExtra);
  const skip = parseInt(params.get('skip')) || 0;
  return Math.floor(skip / 20) + 1;
}

// Rutas de Catálogos (con y sin parámetro "extra")
async function handleCatalogRequest(req, res) {
  const { apiKey, lang, type, id, extra } = req.params;
  const targetLang = lang || 'es-ES';
  const page = getPageFromExtra(extra);

  try {
    const metas = await getCatalog(id, type, apiKey, targetLang, page);
    res.json({ metas });
  } catch (error) {
    console.error('Error cargando catálogo:', error);
    res.status(500).json({ error: error.message });
  }
}

app.get('/:apiKey/catalog/:type/:id.json', handleCatalogRequest);
app.get('/:apiKey/:lang/catalog/:type/:id.json', handleCatalogRequest);
app.get('/:apiKey/catalog/:type/:id/:extra.json', handleCatalogRequest);
app.get('/:apiKey/:lang/catalog/:type/:id/:extra.json', handleCatalogRequest);

// Rutas de Metadatos (Meta)
async function handleMetaRequest(req, res) {
  const { apiKey, lang, type, id } = req.params;
  const targetLang = lang || 'es-ES';
  // El ID de Stremio viene con la extensión .json al final en la ruta Express
  const cleanId = id.replace('.json', '');

  try {
    const meta = await getMetadata(cleanId, type, apiKey, targetLang);
    if (!meta) {
      return res.status(404).json({ error: 'Metadatos no encontrados' });
    }
    res.json({ meta });
  } catch (error) {
    console.error('Error cargando metadatos:', error);
    res.status(500).json({ error: error.message });
  }
}

app.get('/:apiKey/meta/:type/:id', handleMetaRequest);
app.get('/:apiKey/:lang/meta/:type/:id', handleMetaRequest);

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Addon Cinemeta en Español corriendo localmente`);
  console.log(`Página de configuración: http://localhost:${PORT}`);
  if (process.env.TMDB_API_KEY) {
    console.log(`Clave por defecto configurada: ${process.env.TMDB_API_KEY.slice(0, 5)}...`);
    console.log(`Manifiesto por defecto: http://localhost:${PORT}/manifest.json`);
  } else {
    console.log(`Copia esta URL en tu navegador para configurarlo.`);
  }
  console.log(`==================================================`);
});
