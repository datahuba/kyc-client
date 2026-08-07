// F-FIX-NGINX-CONCURRENCY (2026-08-07, Kevin): server.js con cluster mode
// para SvelteKit. El SvelteKit adapter-node por default arranca 1 solo
// proceso Node, que se ahogaba bajo carga concurrente (browser cargando
// 20+ chunks en paralelo + multiples conexiones API + SSE). Con 4 workers
// y SO_REUSEPORT el kernel de Linux distribuye las conexiones entrantes
// entre los workers, dando 4x capacidad de respuesta sin cambiar nada del
// codigo de SvelteKit.
//
// Uso: WEB_CONCURRENCY=N node server.js
//      PORT=3000 node server.js (default)
//
// Si SO_REUSEPORT no esta disponible (ej. en Windows nativo), el server
// cae al modo single-process con 1 worker.

import cluster from 'node:cluster';
import os from 'node:os';
import http from 'node:http';
import process from 'node:process';

const NUM_WORKERS = parseInt(process.env.WEB_CONCURRENCY || '4', 10);
const PORT = parseInt(process.env.PORT || '3000', 10);
const CPU_COUNT = os.cpus().length;

async function startWorker() {
  // Import dinamico del handler compilado de SvelteKit
  const { handler } = await import('./build/handler.js');

  // SO_REUSEPORT: el kernel reparte las conexiones TCP entre los workers
  // que listen en el mismo puerto. Disponible en Linux 3.9+ y Node 20+.
  let server;
  try {
    server = http.createServer({ reusePort: true }, handler);
  } catch (e) {
    console.warn(`[WORKER ${process.pid}] reusePort no disponible (${e.message}), fallback a single-process`);
    server = http.createServer(handler);
  }

  server.listen(PORT, () => {
    console.log(`[WORKER ${process.pid}] listening on port ${PORT} (cpus=${CPU_COUNT})`);
  });

  // Graceful shutdown
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      console.log(`[WORKER ${process.pid}] received ${sig}, closing server`);
      server.close(() => process.exit(0));
    });
  }
}

if (cluster.isPrimary) {
  console.log(`[CLUSTER] Master ${process.pid} starting ${NUM_WORKERS} workers (cpus=${CPU_COUNT})`);

  // Round-robin: el master reparte las conexiones a los workers
  cluster.schedulingPolicy = cluster.SCHED_RR;

  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork();
    worker.on('online', () => {
      console.log(`[CLUSTER] Worker ${worker.process.pid} online (${worker.id})`);
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[CLUSTER] Worker ${worker.process.pid} died (code=${code} signal=${signal}). Forking replacement...`);
    cluster.fork();
  });
} else {
  // Worker: ejecuta el handler de SvelteKit
  startWorker().catch(err => {
    console.error(`[WORKER ${process.pid}] FATAL:`, err);
    process.exit(1);
  });
}
