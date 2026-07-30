/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Crea un nombre de caché único para esta versión
const CACHE = `cache-${version}`;

// Construimos el array de assets que vamos a cachear inicialmente
// SOLO los archivos estáticos de /static, NO los bundles del build.
// Los bundles del build se sirven network-first para que las
// actualizaciones lleguen al usuario sin tener que limpiar cache.
const STATIC_ASSETS = [...files];

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
			keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
		);
	}
	event.waitUntil(deleteOldCaches());
	// Tomar control de todos los clientes abiertos inmediatamente
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Ignorar peticiones que no sean GET o que sean a /api/ (backend de la app, que no debe cachearse)
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.pathname.startsWith('/api/')) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// REGLA: network-first para TODO lo que no sea /static
		// (los bundles del build cambian de hash en cada deploy y no
		// queremos servir uno viejo desde cache).
		const isImmutableBuildAsset = url.pathname.startsWith('/_app/immutable/');

		if (isImmutableBuildAsset) {
			// Network-first: ir a la red, fallback a cache solo si falla
			try {
				const response = await fetch(event.request);
				if (response.status === 200) {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch (err) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw err;
			}
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
