/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Crea un nombre de caché único para esta versión
const CACHE = `cache-${version}`;
// Cache adicional para chunks criticos (mas persistente)
const CHUNKS_CACHE = `chunks-${version}`;

// Construimos el array de assets que vamos a cachear inicialmente
// SOLO los archivos estáticos de /static, NO los bundles del build.
// Los bundles del build se sirven network-first para que las
// actualizaciones lleguen al usuario sin tener que limpiar cache.
const STATIC_ASSETS = [...files];

// F-LOADING-RETRY (2026-08-07, Kevin): retry con backoff exponencial
// para los chunks del bundle de SvelteKit. El problema:
//
// El server (nginx/Hostinger) corta conexiones bajo carga con
// ERR_CONNECTION_RESET cuando el browser abre 6+ conexiones paralelas
// para cargar los chunks lazy-loaded de SvelteKit. Esto causa que
// ~50% de los modulos den body vacio (el JS no renderiza).
//
// Solucion: reintentar con backoff exponencial antes de tirar el
// error. Si el cache tiene el chunk, lo usamos. Si no, reintentamos
// hasta 3 veces con delays de 200ms, 600ms, 1800ms.
const MAX_RETRIES = 3;
const RETRY_DELAYS = [200, 600, 1800]; // ms

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(STATIC_ASSETS);
	}
	event.waitUntil(addFilesToCache());
	// Tomar control inmediatamente sin esperar a que se cierre la pestaña
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	// Limpia TODAS las caches de versiones anteriores cuando se activa el nuevo SW.
	// Esto es crítico: si quedaba una cache de un build anterior con
	// bundles viejos (incluyendo un SW previo con ASSETS hasheados),
	// la borramos. Así garantizamos que el primer load post-actualización
	// vaya a la red.
	async function deleteOldCaches() {
		const keys = await caches.keys();
		await Promise.all(
			keys
				.filter((key) => key !== CACHE && key !== CHUNKS_CACHE)
				.map((key) => caches.delete(key))
		);
	}
	event.waitUntil(deleteOldCaches());
	// Tomar control de todos los clientes abiertos inmediatamente
	self.clients.claim();
});

// F-LOADING-RETRY: helper para hacer fetch con retry y backoff.
// Devuelve la primera respuesta exitosa. Si todas fallan, devuelve
// el ultimo error o un fallback del cache.
async function fetchWithRetry(
	request: Request,
	cachesToCheck: Cache[]
): Promise<Response> {
	let lastError: Error | null = null;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(request.clone());
			if (response.ok) {
				// Cachear la respuesta exitosa
				if (request.url.startsWith('http')) {
					for (const cache of cachesToCheck) {
						try {
							await cache.put(request, response.clone());
						} catch (e) {
							// ignore cache errors
						}
					}
				}
				return response;
			}
			// Si la respuesta no es ok (404, 500), no reintentar
			return response;
		} catch (err) {
			lastError = err as Error;
			if (attempt < MAX_RETRIES) {
				const delay = RETRY_DELAYS[attempt] || 200;
				await new Promise((r) => setTimeout(r, delay));
			}
		}
	}
	// Si llegamos aca, todos los retries fallaron. Buscar en cache.
	for (const cache of cachesToCheck) {
		const cached = await cache.match(request);
		if (cached) return cached;
	}
	throw lastError || new Error('All retries failed');
}

self.addEventListener('fetch', (event) => {
	// Ignorar peticiones que no sean GET o que sean a /api/ (backend de la app, que no debe cachearse)
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.pathname.startsWith('/api/')) return;

	async function respond() {
		const cache = await caches.open(CACHE);
		const chunksCache = await caches.open(CHUNKS_CACHE);

		// REGLA: network-first con retry para TODO lo que no sea /static
		// (los bundles del build cambian de hash en cada deploy y no
		// queremos servir uno viejo desde cache).
		const isImmutableBuildAsset = url.pathname.startsWith('/_app/immutable/');

		if (isImmutableBuildAsset) {
			// F-LOADING-RETRY: network-first con retry + backoff.
			// Cachear chunks en CHUNKS_CACHE (persistente) ademas de CACHE.
			return fetchWithRetry(event.request, [cache, chunksCache]);
		}

		// Para /static/* y otras cosas: cache-first (es contenido que cambia muy poco)
		const cached = await cache.match(event.request);
		if (cached) return cached;

		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch (err) {
			throw err;
		}
	}
	event.respondWith(respond());
});
