/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Crea un nombre de caché único para esta versión
const CACHE = `cache-${version}`;

// Construimos el array de assets que vamos a cachear inicialmente
const ASSETS = [
	...build, // Los archivos generados por SvelteKit
	...files  // Todos los archivos estáticos de la carpeta /static
];

self.addEventListener('install', (event) => {
	// Crea una nueva caché y agrega todos los archivos de la app
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Limpia cachés de versiones anteriores cuando se activa el nuevo SW
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	// Ignorar peticiones que no sean GET o que sean a /api/ (backend de la app, que no debe cachearse)
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// Si el archivo está en la lista de assets iniciales (build o static), servir directo de caché
		if (ASSETS.includes(url.pathname)) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
		}

		// Para otras peticiones, intentamos ir por red primero
		try {
			const response = await fetch(event.request);

			// Si estamos offline, fetch puede fallar, pero si responde un 200 lo guardamos
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			// Si falla la red (offline), intentamos buscar en la caché
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;

			// Si todo falla, SvelteKit por defecto maneja offline como puede, pero tiramos error.
			throw err;
		}
	}

	event.respondWith(respond());
});
