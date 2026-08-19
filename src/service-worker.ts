/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Cache unico para esta version
const CACHE = `cache-${version}`;
const STATIC_ASSETS = [...files];

// F-FIX-SW-SAFE (2026-08-07, Kevin): el SW anterior (F-LOADING-RETRY)
// hacia fetch con retry y backoff en TODAS las requests no-/api. Esto
// causaba 'Uncaught (in promise) TypeError: Failed to fetch' en el SW
// cuando el server tardaba o el browser cancelaba la request. El error
// se propagaba a la app y bloqueaba el render.
//
// Solucion: SW minimal que SOLO cachea assets estaticos. NO intercepta
// /api/. NO hace retry. NO bloquea el flujo. Si algo falla, el browser
// hace fetch normal sin SW.
self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		try {
			await cache.addAll(STATIC_ASSETS);
		} catch (e) {
			console.warn('[SW] cache.addAll failed:', e?.message);
		}
	}
	event.waitUntil(addFilesToCache());
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		const keys = await caches.keys();
		await Promise.all(
			keys
				.filter((key) => key !== CACHE)
				.map((key) => caches.delete(key))
		);
	}
	event.waitUntil(deleteOldCaches());
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Solo interceptar GET a assets del build (cache-first)
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);

	// NO interceptar APIs (dejar pasar al network directo)
	if (url.pathname.startsWith('/api/')) return;

	// Solo cachear assets estaticos del build
	if (!url.pathname.startsWith('/_app/immutable/') &&
	    !url.pathname.startsWith('/static/') &&
	    !url.pathname.startsWith('/images/')) {
		return; // no interceptar otras requests (deja al browser hacer fetch normal)
	}

	event.respondWith(
		(async () => {
			try {
				const cache = await caches.open(CACHE);
				const cached = await cache.match(event.request);
				if (cached) {
					// Cache hit: responder inmediatamente y refrescar en background
					event.waitUntil(
						fetch(event.request).then((response) => {
							if (response && response.ok) {
								cache.put(event.request, response.clone());
							}
						}).catch(() => {})
					);
					return cached;
				}
				// Cache miss: fetch al network
				const response = await fetch(event.request);
				if (response && response.ok) {
					try { cache.put(event.request, response.clone()); } catch (e) {}
				}
				return response;
			} catch (err) {
				// Si todo falla, retornar Response vacia para que el browser no quede colgado
				console.warn('[SW] fetch failed for:', event.request.url, err?.message);
				return new Response('', { status: 503, statusText: 'SW fetch failed' });
			}
		})()
	);
});
