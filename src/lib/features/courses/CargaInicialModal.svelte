<script lang="ts">
	// F-US-006-3TIPOS-3A-FE (2026-08-04): modal de carga inicial de estudiantes
	// para programas en_ejecucion o historicos. El admin/encargado pega los
	// carnets de los estudiantes que ya estaban/estan en el programa y el
	// sistema los inscribe con el flag es_carga_inicial=True.
	//
	// F-HISTORICO-AUTOSERVICIO-EXCEL (2026-08-04): agregada la opcion de subir
	// un Excel con carnet + nombre + email + pagos. El sistema detecta si los
	// estudiantes ya existen (por CI) y permite editar/agregar/eliminar filas
	// antes de confirmar. Los estudiantes nuevos se crean en el mismo submit.
	import { onMount } from 'svelte';
	import * as XLSX from 'xlsx';
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { studentService, discountService } from '$lib/services';
	import { apiKyC } from '$lib/config';
	import { alert } from '$lib/utils';
	import type { Course } from '$lib/interfaces';
	import { UsersIcon, CheckIcon, DocumentAddIcon, TrashIcon, PlusIcon } from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		course: Course | null;
		onSuccess?: () => void;
	}

	let { isOpen, onClose, course, onSuccess }: Props = $props();

	// Pestana activa: 'carnets' o 'excel'
	let tabActiva: 'carnets' | 'excel' = $state('carnets');

	// === MODO CARNETS (existente) ===
	let carnetsText = $state('');
	let moduloInicialIndex = $state<number | null>(null);
	let matriculaPagada = $state(true);
	let cargando = $state(false);

	let estudiantesResueltos = $state<{ id: string; nombre: string; carnet: string; encontrado: boolean }[]>([]);
	let etapa = $state<'input' | 'preview' | 'result'>('input');
	let resultado = $state<{ exitosos: number; ya_inscritos: number; fallidos: number; detalles: any[] } | null>(null);

	// === MODO EXCEL (nuevo) ===

	// Fila del Excel parseado: editable por el usuario
	interface FilaEstudiante {
		// Datos originales del Excel (pueden estar vacios)
		carnet: string;
		nombre: string;
		email: string;
		celular: string;
		// Estado de la fila
		estado: 'nuevo' | 'existe' | 'duplicado' | 'error';
		// Si existe, ID del estudiante en la BD
		estudiante_id?: string;
		// Mensaje de error o info
		mensaje?: string;
		// Pagos del Excel (opcional, mostrados al usuario)
		pagos: { modulo: string; monto: number }[];
		total_pagado?: number;
		// F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): descuento detectado del
		// Excel (0.5 = 50%, 1 = 100%, etc). Se mapea a un descuento_id real
		// del catalogo institucional via catalogoDescuentos.
		descuento_pct?: number;
		descuento_id?: string;
		descuento_origen?: string; // 'institucional' | 'manual_requerido' | 'sin_descuento'
	}

	let filasExcel = $state<FilaEstudiante[]>([]);
	let excelFileName = $state('');
	let parseandoExcel = $state(false);
	let etapaExcel: 'subir' | 'preview' | 'procesando' | 'resultado' = $state('subir');

	// F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): catalogo de descuentos
	// institucionales del Organo Judicial (50%, 30%, 100%). Se carga
	// despues de parsear el Excel para mapear los descuentos detectados
	// (0.5, 1, etc) a descuentos_id reales.
	let catalogoDescuentos: { _id: string; nombre: string; porcentaje: number; es_institucional?: boolean }[] = $state([]);
	let resultadoExcel = $state<{ creados: number; inscritos: number; actualizados: number; fallidos: number; detalles: any[] } | null>(null);

	// Reset al abrir/cerrar
	$effect(() => {
		if (!isOpen) {
			carnetsText = '';
			moduloInicialIndex = null;
			matriculaPagada = true;
			estudiantesResueltos = [];
			etapa = 'input';
			resultado = null;
			tabActiva = 'carnets';
			filasExcel = [];
			excelFileName = '';
			parseandoExcel = false;
			etapaExcel = 'subir';
			resultadoExcel = null;
		}
	});

	function parseCarnets(text: string): string[] {
		return text
			.split(/[\n,;\s]+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	// ========================================================================
	// MODO CARNETS (existente, sin cambios)
	// ========================================================================

	async function resolverCarnets() {
		const carnets = parseCarnets(carnetsText);
		if (carnets.length === 0) {
			alert('error', 'Pega al menos un carnet de estudiante');
			return;
		}
		if (carnets.length > 200) {
			alert('error', 'Maximo 200 carnets por carga. Divide en lotes mas chicos.');
			return;
		}

		cargando = true;
		try {
			const promesas = carnets.map(async (carnet) => {
				try {
					const resp = await studentService.getAll(1, 5, { q: carnet });
					const match = resp.data.find((s: any) => s.carnet === carnet);
					if (match) {
						return { id: match._id, nombre: match.nombre, carnet: match.carnet, encontrado: true };
					}
					return { id: '', nombre: '', carnet, encontrado: false };
				} catch {
					return { id: '', nombre: '', carnet, encontrado: false };
				}
			});
			estudiantesResueltos = await Promise.all(promesas);
			etapa = 'preview';
		} catch (e: any) {
			alert('error', e?.message || 'Error al buscar carnets');
		} finally {
			cargando = false;
		}
	}

	async function confirmarCarga() {
		if (!course) return;
		const encontrados = estudiantesResueltos.filter((e) => e.encontrado && e.id);
		if (encontrados.length === 0) {
			alert('error', 'No hay estudiantes encontrados para cargar');
			return;
		}

		cargando = true;
		try {
			const payload = {
				estudiantes: encontrados.map((e) => ({
					estudiante_id: e.id,
					modulo_inicial_index: moduloInicialIndex !== null ? moduloInicialIndex : undefined,
					matricula_pagada: matriculaPagada,
				})),
			};

			const resp = await apiKyC.post<any>(`/courses/${course._id}/initial-enrollments`, payload);

			resultado = {
				exitosos: resp.exitosos || 0,
				ya_inscritos: resp.ya_inscritos || 0,
				fallidos: resp.fallidos || 0,
				detalles: resp.resultados || [],
			};
			etapa = 'result';

			if (resp.exitosos > 0) {
				alert('success', `${resp.exitosos} estudiante(s) inscrito(s) como carga inicial`);
				if (onSuccess) onSuccess();
			}
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar estudiantes');
		} finally {
			cargando = false;
		}
	}

	// ========================================================================
	// MODO EXCEL (nuevo)
	// ========================================================================

	/**
	 * Normaliza un string para comparacion flexible de nombres de columna:
	 * lowercase, sin acentos, sin espacios/underscores/guiones/parentesis/signos.
	 * Sirve para que "Nombre(s) y Apellido(s)" matchee con "nombre" o "nombresyapellidos".
	 */
	function normColName(s: string): string {
		return s
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // quitar diacriticos
			.replace(/[^a-z0-9]/g, ''); // quitar TODO lo no alfanumerico
	}

	/**
	 * Detecta el nombre de una columna. Estrategia:
	 * 1. Match EXACTO (normalizado) - el mas confiable.
	 * 2. Match por substring SOLO en una direccion: si el nombre de la columna
	 *    INCLUYE al candidato (kNorm.includes(norm)), nunca al reves.
	 *    Esto evita que "carnet" (norm) matchee con "N" (kNorm) porque
	 *    "carnet".includes("n") = true.
	 * 3. Solo aplica substring si ambos (norm y kNorm) tienen >= 4 chars
	 *    normalizados.
	 *
	 * Si la columna no se detecta, devuelve ''.
	 */
	function pickColumn(row: Record<string, any>, ...candidatos: string[]): string {
		const keys = Object.keys(row);
		const normKeys = new Map(keys.map((k) => [k, normColName(k)]));

		// Fase 1: match exacto (mas confiable)
		for (const candidato of candidatos) {
			const norm = normColName(candidato);
			for (const [key, kNorm] of normKeys.entries()) {
				if (kNorm === norm && row[key] != null && String(row[key]).trim() !== '') {
					return String(row[key]).trim();
				}
			}
		}

		// Fase 2: substring match (kNorm incluye a norm) - solo si ambos >= 4
		for (const candidato of candidatos) {
			const norm = normColName(candidato);
			if (norm.length < 4) continue;
			for (const [key, kNorm] of normKeys.entries()) {
				if (kNorm.length < 4) continue; // evitar match con headers cortos tipo "N", "f", etc.
				if (kNorm.includes(norm) && row[key] != null && String(row[key]).trim() !== '') {
					return String(row[key]).trim();
				}
			}
		}

		return '';
	}

	/**
	 * Parsea un numero que puede venir como string "294" o 294 o "294.0".
	 */
	function parseNumero(v: any): number {
		if (v == null) return 0;
		if (typeof v === 'number') return v;
		const s = String(v).replace(/[^\d.-]/g, '');
		const n = parseFloat(s);
		return isNaN(n) ? 0 : n;
	}

	/**
	 * Limpia un email que puede venir con multiples valores separados por
	 * espacio, coma, punto-y-coma o barra. Toma el primer valor valido.
	 * "padillaalberto2026@gmail.com  otro@gmail.com" → "padillaalberto2026@gmail.com"
	 * Si no hay ninguno valido, devuelve ''.
	 */
	function cleanEmail(raw: string): string {
		if (!raw) return '';
		const parts = String(raw)
			.split(/[\s,;|/]+/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
		for (const p of parts) {
			// validacion basica: tiene @ y un punto despues
			if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) {
				return p;
			}
		}
		return '';
	}

	/**
	 * Parsea un Excel cargado como File.
	 * Detecta las columnas dinamicamente (carnet, nombre, email, celular, pagos).
	 */
	async function parsearExcel(file: File) {
		parseandoExcel = true;
		try {
			const buffer = await file.arrayBuffer();
			const workbook = XLSX.read(buffer, { type: 'array' });
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];
			const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

			if (rows.length === 0) {
				alert('error', 'El Excel esta vacio o no tiene datos legibles');
				return;
			}

			// Parsear cada fila
			const filas: FilaEstudiante[] = [];
			for (const row of rows) {
				const carnet = pickColumn(
					row,
					'ci',
					'cisinextension',
					'carnet',
					'cedula',
					'documento',
					'identidad',
					'documentoidentidad'
				);
				const nombre = pickColumn(
					row,
					'nombresyapellidos',
					'nombrecompleto',
					'nombreyapellido',
					'nombre',
					'alumno',
					'estudiante',
					'fullname'
				);
				const email = pickColumn(
					row,
					'direcciondecorreoelectronico',
					'direcciondecorreo',
					'correoelectronico',
					'email',
					'correo',
					'mail'
				);
				const celular = pickColumn(
					row,
					'celular',
					'telefono',
					'phone',
					'movil',
					'f',
					'ndetelefonocelular'
				);

				if (!carnet) {
					filas.push({
						carnet: '',
						nombre,
						email,
						celular,
						estado: 'error',
						mensaje: 'Sin CI/carnet',
						pagos: [],
					});
					continue;
				}

				// Detectar pagos por modulo (columnas que empiezan con "Pago Modulo" o "MODULO")
				const pagos: { modulo: string; monto: number }[] = [];
				for (const key of Object.keys(row)) {
					const kNorm = normColName(key);
					if ((kNorm.startsWith('pago') && kNorm.includes('modulo')) ||
						(kNorm.startsWith('modulo') && !kNorm.includes('total'))) {
						const monto = parseNumero(row[key]);
						if (monto > 0) {
							pagos.push({ modulo: key, monto });
						}
					}
				}

				// F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): detectar descuento
				// del Excel. La columna "DESCUENTOS" tiene un valor que puede ser
				// 0.5 (50%), 1 (100%), o "BECA 100% POR MERITO". Lo mapeamos a
				// un descuento_id del catalogo institucional.
				const descuentoRaw = pickColumn(row, 'descuentos', 'descuento');
				let descuento_pct: number | undefined;
				let descuento_id: string | undefined;
				let descuento_origen: 'institucional' | 'manual_requerido' | 'sin_descuento' = 'sin_descuento';
				if (descuentoRaw) {
					const dStr = String(descuentoRaw).trim().toLowerCase();
					// Detectar "100" o "1" como 100%
					if (dStr === '100' || dStr === '1' || dStr.includes('beca 100') || dStr.includes('merito')) {
						descuento_pct = 100;
					} else {
						// Parsear como decimal: 0.5, 0.7, etc
						const d = parseNumero(descuentoRaw);
						if (d > 0 && d <= 1) {
							descuento_pct = d * 100;
						} else if (d === 100) {
							descuento_pct = 100;
						} else if (d > 0) {
							// Numero raro (ej. 754800): ignorar
							descuento_pct = undefined;
						}
					}
				}

				filas.push({
					carnet,
					nombre,
					email,
					celular,
					estado: 'nuevo', // se actualiza despues del lookup
					pagos,
					total_pagado: pagos.reduce((acc, p) => acc + p.monto, 0),
					descuento_pct,
					descuento_id,
					descuento_origen,
				});
			}

			filasExcel = filas;
			excelFileName = file.name;
			// F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): cargar el catalogo
			// de descuentos institucionales y mapear los descuentos detectados
			// a descuento_id. Si el descuento no matchea ninguno, marcar como
			// 'manual_requerido' (el usuario lo debe asignar manualmente).
			await cargarYMappearDescuentos();
			etapaExcel = 'preview';
			await verificarEstudiantesEnBD();
		} catch (e: any) {
			console.error('Error parseando Excel', e);
			alert('error', `Error al parsear el Excel: ${e?.message || 'desconocido'}`);
		} finally {
			parseandoExcel = false;
		}
	}

	/**
	 * F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): carga el catalogo de
	 * descuentos institucionales y mapea los descuentos_pct detectados
	 * en el Excel a descuento_id reales.
	 * Si el descuento no matchea ninguno (ej. 0.7 = 70% que no tenemos
	 * pre-creado), se marca como 'manual_requerido' y el usuario lo
	 * debe asignar en la UI.
	 */
	async function cargarYMappearDescuentos() {
		try {
			const resp: any = await discountService.getAll();
			catalogoDescuentos = Array.isArray(resp) ? resp : (resp.data || []);
			// Mapear
			for (const fila of filasExcel) {
				if (fila.descuento_pct === undefined) {
					fila.descuento_origen = 'sin_descuento';
					continue;
				}
				// Buscar el descuento que matchee el porcentaje (con tolerancia de 0.1)
				const match = catalogoDescuentos.find(
					(d) => Math.abs(d.porcentaje - fila.descuento_pct!) < 0.1
				);
				if (match) {
					fila.descuento_id = match._id;
					fila.descuento_origen = 'institucional';
				} else {
					fila.descuento_origen = 'manual_requerido';
				}
			}
			filasExcel = [...filasExcel]; // trigger reactivity
		} catch (e) {
			console.warn('No se pudieron cargar descuentos institucionales:', e);
		}
	}

	/**
	 * Verifica cada fila contra la BD: si el CI existe, marca como 'existe'.
	 * Si hay duplicados dentro del mismo Excel, marca como 'duplicado'.
	 *
	 * F-HISTORICO-EXCEL-BATCH-LOOKUP (2026-08-04): antes hacia 1 request
	 * por carnet (~12s c/u, 62 carnets = 12+ min de timeout). Ahora usa
	 * POST /students/batch-lookup que resuelve todos en 1 sola query MongoDB.
	 */
	async function verificarEstudiantesEnBD() {
		// Detectar duplicados primero
		const carnetCount = new Map<string, number>();
		for (const fila of filasExcel) {
			if (fila.carnet) {
				carnetCount.set(fila.carnet, (carnetCount.get(fila.carnet) || 0) + 1);
			}
		}

		// Marcar duplicados y juntar carnets unicos
		const carnetsUnicos = new Set<string>();
		for (const fila of filasExcel) {
			if (!fila.carnet) continue;
			if (carnetCount.get(fila.carnet)! > 1) {
				fila.estado = 'duplicado';
				fila.mensaje = `CI aparece ${carnetCount.get(fila.carnet)} veces en el Excel`;
			} else {
				carnetsUnicos.add(fila.carnet);
			}
		}

		if (carnetsUnicos.size === 0) return;

		// 1 sola llamada batch en vez de N llamadas individuales
		let results: any[] = [];
		try {
			results = await apiKyC.post<any[]>('/students/batch-lookup', {
				carnets: Array.from(carnetsUnicos)
			});
		} catch (e) {
			console.error('Error en batch-lookup, fallback a busqueda individual', e);
			// Fallback: si el endpoint falla, volver al metodo viejo (1 por 1)
			const promesas = Array.from(carnetsUnicos).map(async (carnet) => {
				try {
					const resp = await studentService.getAll(1, 5, { q: carnet });
					const match = resp.data.find((s: any) => s.carnet === carnet);
					return { carnet, match: match || null };
				} catch {
					return { carnet, match: null };
				}
			});
			const fallback = await Promise.all(promesas);
			results = fallback.map((r) => ({
				carnet: r.carnet,
				estudiante_id: r.match?._id,
				nombre: r.match?.nombre,
				existe: !!r.match,
			}));
		}

		const map = new Map(results.map((r) => [r.carnet, r]));

		for (const fila of filasExcel) {
			if (fila.estado === 'duplicado' || !fila.carnet) continue;
			const match = map.get(fila.carnet);
			if (match && match.existe) {
				fila.estado = 'existe';
				fila.estudiante_id = match.estudiante_id;
				fila.mensaje = `Ya existe: ${match.nombre || '(sin nombre)'}`;
				// Completar datos faltantes con los del Excel
				if (!fila.nombre && match.nombre) fila.nombre = match.nombre;
			}
			// Si no existe, ya esta marcado como 'nuevo' (default)
		}
	}

	/**
	 * Remueve una fila del Excel.
	 */
	function eliminarFila(index: number) {
		filasExcel = filasExcel.filter((_, i) => i !== index);
	}

	/**
	 * Agrega una fila vacia al Excel.
	 */
	function agregarFilaVacia() {
		filasExcel = [
			...filasExcel,
			{
				carnet: '',
				nombre: '',
				email: '',
				celular: '',
				estado: 'nuevo',
				pagos: [],
			},
		];
	}

	/**
	 * Confirma la carga: para cada fila nueva, crea el estudiante via API.
	 * Para las existentes, solo las inscribe.
	 */
	async function confirmarCargaExcel() {
		if (!course) return;
		const filasValidas = filasExcel.filter((f) => f.carnet && f.estado !== 'duplicado' && f.estado !== 'error');
		if (filasValidas.length === 0) {
			alert('error', 'No hay estudiantes validos para cargar');
			return;
		}

		cargando = true;
		etapaExcel = 'procesando';
		const detalles: any[] = [];
		let creados = 0;
		let inscritos = 0;
		let actualizados = 0;
		let fallidos = 0;

		try {
			// Paso 1: crear estudiantes nuevos
			for (const fila of filasValidas.filter((f) => f.estado === 'nuevo')) {
				try {
					const nuevo = await crearEstudianteDesdeFila(fila);
					fila.estudiante_id = nuevo._id;
					fila.estado = 'existe'; // ahora existe
					creados++;
				} catch (e: any) {
					fila.estado = 'error';
					fila.mensaje = e?.response?.data?.detail || e?.message || 'Error creando';
					fallidos++;
				}
			}

			// Paso 2: inscribir a todos los que quedaron con ID
			const idsParaInscribir = filasValidas
				.filter((f) => f.estudiante_id);
			if (idsParaInscribir.length > 0) {
				// F-HISTORICO-EXCEL-TIMEOUT (2026-08-04): el backend procesa
				// cada item serial (~500ms-1.5s c/u, 62 items = 30-90s).
				// Dividir en chunks PEQUEÑOS (10 items) para que cada request
				// tarde < 15s (margen del timeout de 30s del cliente).
				// 3 chunks en paralelo = 30 items en 15s = 62 items en ~30s.
				const CHUNK_SIZE = 10;
				const items = idsParaInscribir.map((f) => {
					const pagosModulos: Record<string, number> = {};
					const modulosCurso: any[] = (course as any)?.modulos || [];
					for (const pago of f.pagos || []) {
						const m = String(pago.modulo).match(/(\d+)\s*$/);
						if (m) {
							const excelIdx = parseInt(m[1], 10);
							const cursoIdx = excelIdx - 1;
							if (cursoIdx >= 0 && cursoIdx < modulosCurso.length) {
								pagosModulos[String(cursoIdx)] = pago.monto;
							}
						}
					}
					return {
						estudiante_id: f.estudiante_id,
						fila: f,
						item: {
							estudiante_id: f.estudiante_id,
							modulo_inicial_index: moduloInicialIndex !== null ? moduloInicialIndex : undefined,
							matricula_pagada: matriculaPagada,
							pagos_modulos: Object.keys(pagosModulos).length > 0 ? pagosModulos : undefined,
						},
					};
				});

				// Dividir en chunks
				const chunks: typeof items[] = [];
				for (let i = 0; i < items.length; i += CHUNK_SIZE) {
					chunks.push(items.slice(i, i + CHUNK_SIZE));
				}

				// Procesar chunks en paralelo (max 3 a la vez para no saturar)
				const PARALLEL = 3;
				let chunkIndex = 0;
				const results: any[] = [];
				const ejecutarChunk = async (chunk: typeof items) => {
					// F-HISTORICO-EXCEL-TIMEOUT (2026-08-04): customTimeout=120s
					// porque cada item tarda 0.5-1.5s serial en el backend.
					const resp = await apiKyC.post<any>(
						`/courses/${course._id}/initial-enrollments`,
						{ estudiantes: chunk.map((c) => c.item) },
						{ customTimeout: 120000 }
					);
					return { chunk, resp };
				};
				while (chunkIndex < chunks.length) {
					const batch = chunks.slice(chunkIndex, chunkIndex + PARALLEL);
					const batchResults = await Promise.all(batch.map(ejecutarChunk));
					results.push(...batchResults);
					chunkIndex += PARALLEL;
				}

				// Acumular resultados
				for (const { chunk, resp } of results) {
					inscritos += resp.exitosos || 0;
					fallidos += resp.fallidos || 0;
					for (const r of resp.resultados || []) {
						const itemChunk = chunk.find((c) => c.estudiante_id === r.estudiante_id);
						if (itemChunk) {
							if (r.success) {
								itemChunk.fila.estado = 'existe';
								if (r.message && r.message.includes('actualizaron pagos')) {
									actualizados++;
								}
							} else {
								itemChunk.fila.estado = 'error';
								itemChunk.fila.mensaje = r.message || 'Error en inscripcion';
							}
						}
					}
				}
			}

			resultadoExcel = { creados, inscritos, actualizados, fallidos, detalles };
			etapaExcel = 'resultado';

			if (inscritos > 0 || creados > 0) {
				const msg = actualizados > 0
					? `${creados} creado(s), ${inscritos} procesado(s) (${actualizados} con pagos actualizados)`
					: `${creados} creado(s), ${inscritos} inscrito(s)`;
				alert('success', msg);
				if (onSuccess) onSuccess();
			}
		} catch (e: any) {
			console.error('Error en confirmacion Excel', e);
			alert('error', e?.message || 'Error al procesar el Excel');
		} finally {
			cargando = false;
		}
	}

	/**
	 * Crea un estudiante en la BD con los datos minimos requeridos
	 * (los del Excel + defaults para campos faltantes).
	 */
	async function crearEstudianteDesdeFila(fila: FilaEstudiante): Promise<any> {
		// NO enviar course_id: el endpoint POST /students/ con course_id
		// auto-inscribe al estudiante, lo que hace que initial-enrollments
		// falle por duplicado. La inscripcion + pagos se hace en el paso 2
		// via /courses/{id}/initial-enrollments con pagos_modulos.
		const emailLimpio = cleanEmail(fila.email) || `${fila.carnet}@sin-email.local`;
		const payload: any = {
			registro: fila.carnet, // usar CI como registro
			carnet: fila.carnet,
			complemento_carnet: '',
			nombre: fila.nombre || `Sin nombre (${fila.carnet})`,
			extension: '',
			fecha_nacimiento: '1990-01-01', // default razonable
			celular: fila.celular || '',
			email: emailLimpio,
			domicilio: 'Sin registrar',
			activo: true,
		};
		return await studentService.create(payload);
	}

	// ========================================================================
	// COMMON
	// ========================================================================

	function cerrar() {
		onClose();
	}

	let totalCarnets = $derived(parseCarnets(carnetsText).length);
	let encontradosCount = $derived(estudiantesResueltos.filter((e) => e.encontrado).length);
	let noEncontradosCount = $derived(estudiantesResueltos.filter((e) => !e.encontrado).length);
	let esEnEjecucion = $derived(course?.estado_calculado === 'en_ejecucion');
	let modulosDelCurso = $derived((course as any)?.modulos || []);

	// Conteos para el modo Excel
	let excelNuevos = $derived(filasExcel.filter((f) => f.estado === 'nuevo').length);
	let excelExisten = $derived(filasExcel.filter((f) => f.estado === 'existe').length);
	let excelDuplicados = $derived(filasExcel.filter((f) => f.estado === 'duplicado').length);
	let excelErrores = $derived(filasExcel.filter((f) => f.estado === 'error').length);
	let excelValidos = $derived(filasExcel.filter((f) => f.estado === 'nuevo' || f.estado === 'existe').length);
</script>

<Modal {isOpen} onClose={cerrar} title="Carga Inicial de Estudiantes" size="lg">
	{#if !course}
		<p class="text-sm text-gray-500">No hay programa seleccionado.</p>
	{:else}
		<div class="space-y-4">
			<!-- Header con info del curso -->
			<div class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-500 dark:text-gray-400">Programa</div>
				<div class="text-sm font-semibold text-gray-900 dark:text-white">
					{course.codigo} - {course.nombre_programa}
				</div>
				<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Estado: <span class="font-mono">{course.estado_calculado || course.estado}</span>
					{#if esEnEjecucion}
						<span class="ml-2 inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
							EN EJECUCION
						</span>
					{:else}
						<span class="ml-2 inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
							HISTORICO / CERRADO
						</span>
					{/if}
				</div>
			</div>

			<!-- TABS: Carnets | Excel -->
			{#if etapa === 'input' && etapaExcel === 'subir'}
				<div class="border-b border-gray-200 dark:border-gray-700">
					<div class="flex gap-1">
						<button
							type="button"
							class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
								{tabActiva === 'carnets'
									? 'border-primary-600 text-primary-700 dark:text-primary-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
							onclick={() => (tabActiva = 'carnets')}
						>
							📋 Pegar carnets
						</button>
						<button
							type="button"
							class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
								{tabActiva === 'excel'
									? 'border-primary-600 text-primary-700 dark:text-primary-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
							onclick={() => (tabActiva = 'excel')}
						>
							📊 Subir Excel
						</button>
					</div>
				</div>
			{/if}

			<!-- ============== MODO CARNETS ============== -->
			{#if tabActiva === 'carnets' && etapa === 'input'}
				<div class="space-y-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Carnets de estudiantes
						</label>
						<textarea
							bind:value={carnetsText}
							rows="6"
							placeholder="Pega los carnets separados por nueva linea, coma o espacio. Ej:&#10;8099472-1O&#10;4702096&#10;1035489"
							class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						></textarea>
						<p class="mt-1 text-xs text-gray-500">
							{totalCarnets} carnet{totalCarnets === 1 ? '' : 'es'} detectado{totalCarnets === 1 ? '' : 's'}
						</p>
					</div>

					{#if esEnEjecucion}
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Modulo inicial (opcional, para en_ejecucion)
							</label>
							<select
								bind:value={moduloInicialIndex}
								class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
							>
								<option value={null}>-- Sin asignar (dejar para configurar despues) --</option>
								{#each modulosDelCurso as modulo, i}
									<option value={i}>
										{i + 1}. {modulo.nombre} (Bs {modulo.costo})
									</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-gray-500">
								Los modulos ANTERIORES al seleccionado se marcaran como pagados automaticamente.
							</p>
						</div>
					{/if}

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={matriculaPagada}
							class="rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							Marcar matricula como pagada (caso retroactivo/historico)
						</span>
					</label>
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={cerrar}>Cancelar</Button>
					<Button type="button" loading={cargando} disabled={totalCarnets === 0} onclick={resolverCarnets}>
						<UsersIcon class="size-4" />
						Buscar estudiantes
					</Button>
				</div>

			<!-- ============== MODO EXCEL: SUBIR ============== -->
			{:else if tabActiva === 'excel' && etapaExcel === 'subir'}
				<div class="space-y-3">
					<div class="rounded-md border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
						<DocumentAddIcon class="mx-auto size-8 text-gray-400" />
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
							Subi un Excel (.xlsx) con los estudiantes. Columnas esperadas:
						</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
							<strong>CI</strong> (obligatorio), <strong>Nombre</strong>, <strong>Email</strong>, <strong>Celular</strong>, <strong>Pago Modulo 1</strong>, ...
						</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
							El sistema detecta automaticamente las columnas aunque tengan nombres distintos (carnet/cedula/documento, telefono/f, etc.)
						</p>
						<label class="mt-4 inline-block cursor-pointer rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
							Seleccionar archivo
							<input
								type="file"
								accept=".xlsx,.xls"
								class="hidden"
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (file) parsearExcel(file);
								}}
							/>
						</label>
					</div>
				</div>

			<!-- ============== MODO EXCEL: PREVIEW ============== -->
			{:else if tabActiva === 'excel' && etapaExcel === 'preview'}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<p class="text-xs text-gray-600 dark:text-gray-400">
							<strong>{excelFileName}</strong> - {filasExcel.length} filas detectadas
						</p>
						<button
							type="button"
							class="text-xs text-primary-600 hover:underline"
							onclick={() => {
								etapaExcel = 'subir';
								filasExcel = [];
								excelFileName = '';
							}}
						>
							← Subir otro archivo
						</button>
					</div>

					<div class="grid grid-cols-4 gap-2 text-center">
						<div class="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
							<div class="text-2xl font-bold text-green-700 dark:text-green-300">{excelExisten}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Ya existen</div>
						</div>
						<div class="rounded-md bg-blue-50 p-2 dark:bg-blue-900/20">
							<div class="text-2xl font-bold text-blue-700 dark:text-blue-300">{excelNuevos}</div>
							<div class="text-xs text-blue-600 dark:text-blue-400">Nuevos</div>
						</div>
						<div class="rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
							<div class="text-2xl font-bold text-amber-700 dark:text-amber-300">{excelDuplicados}</div>
							<div class="text-xs text-amber-600 dark:text-amber-400">Duplicados</div>
						</div>
						<div class="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
							<div class="text-2xl font-bold text-red-700 dark:text-red-300">{excelErrores}</div>
							<div class="text-xs text-red-600 dark:text-red-400">Errores</div>
						</div>
					</div>

					<div class="max-h-72 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
								<tr>
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">CI</th>
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Nombre</th>
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Email</th>
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Celular</th>
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Pagos</th>
									<!-- F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): columna de descuento -->
									<th class="px-2 py-1.5 text-left text-xs font-medium text-gray-500">Desc.</th>
									<th class="px-2 py-1.5 text-center text-xs font-medium text-gray-500">Estado</th>
									<th class="px-2 py-1.5 text-center text-xs font-medium text-gray-500"></th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
								{#each filasExcel as fila, i (i)}
									<tr
										class="{fila.estado === 'duplicado' ? 'bg-amber-50 dark:bg-amber-900/10' : ''} {fila.estado === 'error' ? 'bg-red-50 dark:bg-red-900/10' : ''}"
									>
										<td class="px-2 py-1 text-xs font-mono">
											<input
												type="text"
												bind:value={fila.carnet}
												class="w-24 bg-transparent text-xs font-mono focus:outline-none focus:bg-white focus:dark:bg-gray-800 rounded px-1"
											/>
										</td>
										<td class="px-2 py-1 text-xs">
											<input
												type="text"
												bind:value={fila.nombre}
												class="w-full bg-transparent text-xs focus:outline-none focus:bg-white focus:dark:bg-gray-800 rounded px-1"
											/>
										</td>
										<td class="px-2 py-1 text-xs">
											<input
												type="email"
												bind:value={fila.email}
												class="w-32 bg-transparent text-xs focus:outline-none focus:bg-white focus:dark:bg-gray-800 rounded px-1"
											/>
										</td>
										<td class="px-2 py-1 text-xs">
											<input
												type="text"
												bind:value={fila.celular}
												class="w-20 bg-transparent text-xs focus:outline-none focus:bg-white focus:dark:bg-gray-800 rounded px-1"
											/>
										</td>
										<td class="px-2 py-1 text-xs">
											{#if fila.total_pagado && fila.total_pagado > 0}
												<span class="font-mono">Bs {fila.total_pagado.toFixed(2)}</span>
												<span class="text-gray-400"> ({fila.pagos.length} pagos)</span>
											{:else}
												<span class="text-gray-400">-</span>
											{/if}
										</td>
										<!-- F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): descuento
										     detectado del Excel, mapeado a descuento_id.
										     - Si matchea uno institucional: badge verde.
										     - Si no matchea (ej. 70%): select para asignar manual.
										     - Si no hay descuento en el Excel: select vacio.
										     Kevin: "si no estuviera que pregunte si tenia
										     descuentos a de manera manual se ponga". -->
										<td class="px-2 py-1 text-xs" style="min-width: 140px">
											{#if fila.descuento_origen === 'institucional' && fila.descuento_pct !== undefined}
												<span class="inline-flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
													{fila.descuento_pct}% ✓
												</span>
											{:else}
												<!-- Si el descuento es manual_requerido o sin_descuento,
												     mostramos un select para que el usuario lo asigne. -->
												<select
													class="block w-full rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[11px] text-gray-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
													value={fila.descuento_id || ''}
													onchange={(e) => {
														const val = (e.currentTarget as HTMLSelectElement).value;
														fila.descuento_id = val || undefined;
														if (val) {
															const sel = catalogoDescuentos.find((d) => d._id === val);
															fila.descuento_pct = sel ? sel.porcentaje : undefined;
															fila.descuento_origen = sel?.es_institucional ? 'institucional' : 'sin_descuento';
														} else {
															fila.descuento_origen = fila.descuento_pct !== undefined ? 'manual_requerido' : 'sin_descuento';
														}
														filasExcel = [...filasExcel]; // trigger reactivity
													}}
												>
													<option value="">
														{fila.descuento_pct !== undefined
															? `${fila.descuento_pct}% ⚠ manual`
															: 'Sin descuento'}
													</option>
													{#each catalogoDescuentos as d}
														<option value={d._id}>
															{d.nombre} ({d.porcentaje}%)
															{d.es_institucional ? ' ★' : ''}
														</option>
													{/each}
												</select>
											{/if}
										</td>
										<td class="px-2 py-1 text-center">
											{#if fila.estado === 'existe'}
												<span class="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
													EXISTE
												</span>
											{:else if fila.estado === 'nuevo'}
												<span class="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
													NUEVO
												</span>
											{:else if fila.estado === 'duplicado'}
												<span class="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
													DUPLICADO
												</span>
											{:else}
												<span class="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800" title={fila.mensaje}>
													ERROR
												</span>
											{/if}
										</td>
										<td class="px-2 py-1 text-center">
											<button
												type="button"
												class="text-red-500 hover:text-red-700"
												onclick={() => eliminarFila(i)}
												title="Eliminar fila"
											>
												<TrashIcon class="size-4" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="flex items-center justify-between">
						<button
							type="button"
							class="text-xs text-primary-600 hover:underline flex items-center gap-1"
							onclick={agregarFilaVacia}
						>
							<PlusIcon class="size-3" /> Agregar fila manual
						</button>
						<p class="text-xs text-gray-500">
							{excelValidos} estudiante{excelValidos === 1 ? '' : 's'} a inscribir
						</p>
					</div>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={matriculaPagada}
							class="rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							Marcar matricula como pagada
						</span>
					</label>
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={cerrar}>Cancelar</Button>
					<Button
						type="button"
						loading={cargando}
						disabled={excelValidos === 0}
						onclick={confirmarCargaExcel}
					>
						<CheckIcon class="size-4" />
						Crear {excelNuevos > 0 ? excelNuevos + ' + ' : ''}e inscribir {excelValidos} estudiante{excelValidos === 1 ? '' : 's'}
					</Button>
				</div>

			<!-- ============== MODO EXCEL: PROCESANDO ============== -->
			{:else if tabActiva === 'excel' && etapaExcel === 'procesando'}
				<div class="py-8 text-center">
					<div class="mx-auto size-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
					<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
						Procesando {filasExcel.length} estudiantes...
					</p>
				</div>

			<!-- ============== MODO EXCEL: RESULTADO ============== -->
			{:else if tabActiva === 'excel' && etapaExcel === 'resultado' && resultadoExcel}
				<div class="space-y-4 py-4">
					<div class="grid grid-cols-4 gap-2 text-center">
						<div class="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
							<div class="text-3xl font-bold text-blue-700 dark:text-blue-300">{resultadoExcel.creados}</div>
							<div class="text-xs text-blue-600 dark:text-blue-400">Creados</div>
						</div>
						<div class="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
							<div class="text-3xl font-bold text-green-700 dark:text-green-300">{resultadoExcel.inscritos}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Procesados</div>
						</div>
						<div class="rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
							<div class="text-3xl font-bold text-amber-700 dark:text-amber-300">{resultadoExcel.actualizados || 0}</div>
							<div class="text-xs text-amber-600 dark:text-amber-400">Actualizados</div>
						</div>
						<div class="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
							<div class="text-3xl font-bold text-red-700 dark:text-red-300">{resultadoExcel.fallidos}</div>
							<div class="text-xs text-red-600 dark:text-red-400">Fallidos</div>
						</div>
					</div>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="primary" onclick={cerrar}>Cerrar</Button>
				</div>

			<!-- ============== MODO CARNETS: PREVIEW (existente) ============== -->
			{:else if tabActiva === 'carnets' && etapa === 'preview'}
				<div class="space-y-3">
					<div class="grid grid-cols-3 gap-2 text-center">
						<div class="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
							<div class="text-2xl font-bold text-green-700 dark:text-green-300">{encontradosCount}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Encontrados</div>
						</div>
						<div class="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
							<div class="text-2xl font-bold text-red-700 dark:text-red-300">{noEncontradosCount}</div>
							<div class="text-xs text-red-600 dark:text-red-400">No encontrados</div>
						</div>
						<div class="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
							<div class="text-2xl font-bold text-gray-700 dark:text-gray-300">{totalCarnets}</div>
							<div class="text-xs text-gray-600 dark:text-gray-400">Total</div>
						</div>
					</div>

					<div class="max-h-60 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
								<tr>
									<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Carnet</th>
									<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
									<th class="px-3 py-2 text-center text-xs font-medium text-gray-500">Estado</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
								{#each estudiantesResueltos as est}
									<tr>
										<td class="px-3 py-2 text-xs font-mono">{est.carnet}</td>
										<td class="px-3 py-2 text-xs">{est.nombre || '-'}</td>
										<td class="px-3 py-2 text-center">
											{#if est.encontrado}
												<span class="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
													OK
												</span>
											{:else}
												<span class="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
													NO ENCONTRADO
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if noEncontradosCount > 0}
						<p class="text-xs text-amber-600 dark:text-amber-400">
							Los carnets no encontrados se omitiran. Verifica que esten escritos correctamente o que
							los estudiantes existan en el sistema.
						</p>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={() => (etapa = 'input')}>Volver</Button>
					<Button
						type="button"
						loading={cargando}
						disabled={encontradosCount === 0}
						onclick={confirmarCarga}
					>
						<CheckIcon class="size-4" />
						Inscribir {encontradosCount} estudiante{encontradosCount === 1 ? '' : 's'}
					</Button>
				</div>

			<!-- ============== MODO CARNETS: RESULT (existente) ============== -->
			{:else if tabActiva === 'carnets' && etapa === 'result' && resultado}
				<div class="space-y-4 py-4">
					<div class="grid grid-cols-3 gap-3 text-center">
						<div class="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
							<div class="text-3xl font-bold text-green-700 dark:text-green-300">{resultado.exitosos}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Exitosos</div>
						</div>
						<div class="rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
							<div class="text-3xl font-bold text-amber-700 dark:text-amber-300">{resultado.ya_inscritos}</div>
							<div class="text-xs text-amber-600 dark:text-amber-400">Ya inscritos</div>
						</div>
						<div class="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
							<div class="text-3xl font-bold text-red-700 dark:text-red-300">{resultado.fallidos}</div>
							<div class="text-xs text-red-600 dark:text-red-400">Fallidos</div>
						</div>
					</div>
				</div>
				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="primary" onclick={cerrar}>Cerrar</Button>
				</div>
			{/if}
		</div>
	{/if}
</Modal>
