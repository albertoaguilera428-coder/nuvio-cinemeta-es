import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'cache.json');
let cache = {
  tmdb_to_imdb: {},
  imdb_to_tmdb: {},
  metadata: {}
};

// Cargar la caché desde el archivo si existe
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    cache = JSON.parse(data);
    // Inicializar propiedades si faltan
    if (!cache.tmdb_to_imdb) cache.tmdb_to_imdb = {};
    if (!cache.imdb_to_tmdb) cache.imdb_to_tmdb = {};
    if (!cache.metadata) cache.metadata = {};
  }
} catch (error) {
  console.error('Error al cargar la caché:', error);
}

// Guardar la caché en el archivo
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar la caché:', error);
  }
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Función auxiliar para peticiones HTTP
async function tmdbRequest(endpoint, apiKey, params = {}) {
  const urlParams = new URLSearchParams({
    api_key: apiKey,
    ...params
  });
  const url = `${TMDB_BASE_URL}${endpoint}?${urlParams.toString()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key de TMDB inválida.');
      }
      throw new Error(`Error en TMDB API (${response.status}): ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error de red o API en endpoint ${endpoint}:`, error.message);
    throw error;
  }
}

// Obtener IMDb ID a partir de TMDB ID
export async function getImdbId(tmdbId, type, apiKey) {
  const cacheKey = `${type}:${tmdbId}`;
  if (cache.tmdb_to_imdb[cacheKey]) {
    return cache.tmdb_to_imdb[cacheKey];
  }

  try {
    const endpoint = type === 'movie' ? `/movie/${tmdbId}/external_ids` : `/tv/${tmdbId}/external_ids`;
    const data = await tmdbRequest(endpoint, apiKey);
    const imdbId = data.imdb_id;
    
    if (imdbId) {
      cache.tmdb_to_imdb[cacheKey] = imdbId;
      cache.imdb_to_tmdb[imdbId] = { id: tmdbId, type };
      saveCache();
      return imdbId;
    }
  } catch (error) {
    console.error(`Error obteniendo IMDb ID para ${type} ${tmdbId}:`, error);
  }
  return null;
}

// Obtener TMDB ID y tipo a partir de un IMDb ID
export async function getTmdbInfo(imdbId, apiKey) {
  if (cache.imdb_to_tmdb[imdbId]) {
    return cache.imdb_to_tmdb[imdbId];
  }

  try {
    const data = await tmdbRequest(`/find/${imdbId}`, apiKey, {
      external_source: 'imdb_id'
    });

    let id = null;
    let type = null;

    if (data.movie_results && data.movie_results.length > 0) {
      id = data.movie_results[0].id;
      type = 'movie';
    } else if (data.tv_results && data.tv_results.length > 0) {
      id = data.tv_results[0].id;
      type = 'series';
    }

    if (id && type) {
      const info = { id, type };
      cache.imdb_to_tmdb[imdbId] = info;
      cache.tmdb_to_imdb[`${type}:${id}`] = imdbId;
      saveCache();
      return info;
    }
  } catch (error) {
    console.error(`Error resolviendo IMDb ID ${imdbId} en TMDB:`, error);
  }
  return null;
}

// Formatear metadatos para Stremio/Nuvio
function formatMeta(data, type, imdbId) {
  const genres = data.genres ? data.genres.map(g => g.name) : [];
  const releaseYear = type === 'movie' 
    ? (data.release_date ? data.release_date.split('-')[0] : '')
    : (data.first_air_date ? `${data.first_air_date.split('-')[0]}-` : '');

  const poster = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null;
  const background = data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null;

  // Obtener director y actores
  const cast = [];
  const directors = [];
  if (data.credits && data.credits.cast) {
    cast.push(...data.credits.cast.slice(0, 5).map(c => c.name));
  }
  if (data.credits && data.credits.crew) {
    directors.push(...data.credits.crew.filter(c => c.job === 'Director').map(c => c.name));
  }

  const meta = {
    id: imdbId,
    type,
    name: data.title || data.name,
    genres,
    poster,
    background,
    description: data.overview || 'Sin descripción disponible en español.',
    releaseInfo: releaseYear,
    runtime: type === 'movie' 
      ? (data.runtime ? `${data.runtime} min` : '')
      : (data.episode_run_time && data.episode_run_time.length > 0 ? `${data.episode_run_time[0]} min` : ''),
    imdbRating: data.vote_average ? data.vote_average.toFixed(1) : undefined,
    cast,
    directors: type === 'movie' ? directors : undefined
  };

  return meta;
}

// Obtener detalles completos de película o serie en español
export async function getMetadata(id, type, apiKey, lang = 'es-ES') {
  // Verificar si es un ID de IMDb o TMDB
  let imdbId = id;
  let tmdbId = null;
  let contentType = type;

  if (id.startsWith('tmdb:')) {
    tmdbId = parseInt(id.split(':')[1]);
  } else if (id.startsWith('tt')) {
    const info = await getTmdbInfo(id, apiKey);
    if (!info) return null;
    tmdbId = info.id;
    contentType = info.type; // Ajustar por si Stremio envió un tipo incorrecto
  } else {
    tmdbId = parseInt(id);
  }

  if (!tmdbId) return null;

  // Si no teníamos el IMDb ID, lo recuperamos
  if (!imdbId.startsWith('tt')) {
    imdbId = await getImdbId(tmdbId, contentType, apiKey) || `tmdb:${tmdbId}`;
  }

  const cacheKey = `meta:${contentType}:${tmdbId}:${lang}`;
  const cached = cache.metadata[cacheKey];
  
  // Caché de metadatos expira en 24 horas
  if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
    return cached.data;
  }

  const endpoint = contentType === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const details = await tmdbRequest(endpoint, apiKey, {
    language: lang,
    append_to_response: 'credits'
  });

  const formattedMeta = formatMeta(details, contentType, imdbId);

  // Si es serie, necesitamos obtener la lista de episodios estructurada para Stremio
  if (contentType === 'series') {
    formattedMeta.videos = [];
    
    // Obtener los episodios de todas las temporadas disponibles
    if (details.seasons && details.seasons.length > 0) {
      const seasonPromises = details.seasons
        .filter(s => s.season_number > 0) // Ignorar especiales temporada 0 por simplicidad o incluirlos si es necesario
        .map(async (season) => {
          try {
            const seasonDetails = await tmdbRequest(`/tv/${tmdbId}/season/${season.season_number}`, apiKey, {
              language: lang
            });
            
            return seasonDetails.episodes.map(ep => ({
              id: `${imdbId}:${ep.season_number}:${ep.episode_number}`,
              title: ep.name || `Episodio ${ep.episode_number}`,
              released: ep.air_date ? new Date(ep.air_date).toISOString() : new Date().toISOString(),
              season: ep.season_number,
              episode: ep.episode_number,
              overview: ep.overview || 'Sin descripción disponible en español.',
              thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null
            }));
          } catch (e) {
            console.error(`Error cargando temporada ${season.season_number} para serie ${tmdbId}:`, e);
            return [];
          }
        });

      const seasonsEpisodes = await Promise.all(seasonPromises);
      formattedMeta.videos = seasonsEpisodes.flat().sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episode - b.episode;
      });
    }
  }

  // Guardar en la caché
  cache.metadata[cacheKey] = {
    timestamp: Date.now(),
    data: formattedMeta
  };
  saveCache();

  return formattedMeta;
}

// Obtener un catálogo de TMDB
export async function getCatalog(catalogId, type, apiKey, lang = 'es-ES', page = 1) {
  let endpoint = '';
  if (type === 'movie') {
    endpoint = catalogId === 'tmdb_popular' ? '/movie/popular' : '/movie/top_rated';
  } else {
    endpoint = catalogId === 'tmdb_popular' ? '/tv/popular' : '/tv/top_rated';
  }

  const data = await tmdbRequest(endpoint, apiKey, {
    language: lang,
    page
  });

  if (!data.results) return [];

  // Mapear los resultados y resolver sus IMDb IDs
  const items = await Promise.all(data.results.map(async (item) => {
    const tmdbId = item.id;
    const imdbId = await getImdbId(tmdbId, type, apiKey) || `tmdb:${tmdbId}`;

    return {
      id: imdbId,
      type,
      name: item.title || item.name,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      description: item.overview,
      releaseInfo: type === 'movie'
        ? (item.release_date ? item.release_date.split('-')[0] : '')
        : (item.first_air_date ? item.first_air_date.split('-')[0] : ''),
      imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined
    };
  }));

  return items;
}
