<script lang="ts">
	// F-DASHBOARD-R9 (2026-08-05 20:40, Kevin): KPI de inscritos POR PROGRAMA.
	// ISSUE R9 (reunion 2026-08-04, transcripcion 2):
	// "Al hacer click en una card de programa, mostrar: total inscritos,
	//  activos, congelados, modulos completados".
	// ISSUE R10: eliminar "Abandono" y "Pasivo" del dashboard, solo "Congelado".
	// Refleja el endpoint GET /enrollments/stats/resumen?curso_id=X.
	import { enrollmentService, studentService } from '$lib/services';
	import type { EnrollmentResumen, Student } from '$lib/interfaces';

	interface Props {
		cursoId: string;
		cursoNombre?: string;
		cursoCodigo?: string;
	}

	let { cursoId, cursoNombre = '', cursoCodigo = '' }: Props = $props();

	let resumen: EnrollmentResumen | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);

	// Cache de estudiantes del curso (id -> Student) para resolver nombres
	let estudiantesById: Map<string, Student> = $state(new Map());

	// Drill-down: lista de estudiantes por categoria
	type Categoria = 'congelados' | 'completados' | 'activos' | 'todos';
	let categoriaActiva: Categoria | null = $state(null);
	let estudiantes: any[] = $state([]);
	let loadingEstudiantes = $state(false);
	let errorEstudiantes: string | null = $state(null);

	async function cargarResumen() {
		loading = true;
		error = null;
		try {
			resumen = await enrollmentService.getResumenInscritos(cursoId);
		} catch (e: any) {
			error = e.message || 'Error al cargar resumen';
			resumen = null;
		} finally {
			loading = false;
		}
	}

	async function verDetalle(cat: Categoria) {
		if (categoriaActiva === cat) {
			// Toggle: cerrar
			categoriaActiva = null;
			estudiantes = [];
			return;
		}
		categoriaActiva = cat;
		estudiantes = [];
		loadingEstudiantes = true;
		errorEstudiantes = null;
		try {
			// Cargar todos los enrollments del curso, luego filtrar client-side
			const todos = await enrollmentService.getByCourseId(cursoId);
			const lista = Array.isArray(todos) ? todos : [];
			if (cat === 'todos') {
				estudiantes = lista;
			} else if (cat === 'activos') {
				// F-DASHBOARD-R10-FIX2 (2026-08-06): "completado" se calcula por
				// modulos aprobados (no por enrollment.estado). Aqui mostramos
				// los que NO estan suspendidos Y NO completados (no congelados,
				// no retirados). El backend cuenta activos como activo+pendiente_pago.
				estudiantes = lista.filter((e: any) =>
					['activo', 'pendiente_pago'].includes(e.estado)
				);
			} else if (cat === 'congelados') {
				// ISSUE R10: solo congelado (motivo_suspension presente)
				estudiantes = lista.filter((e: any) =>
					e.estado === 'suspendido' && e.motivo_suspension === 'congelado'
				);
			} else if (cat === 'completados') {
				// F-DASHBOARD-R10-FIX2: contar los que tienen TODOS los modulos
				// con estado_academico='Aprobado' (coincide con la logica del
				// backend del endpoint /stats/resumen).
				estudiantes = lista.filter((e: any) => {
					const mods = e.modulos || [];
					if (mods.length === 0) return false;
					return mods.every((m: any) => m.estado_academico === 'Aprobado');
				});
			}
		} catch (e: any) {
			errorEstudiantes = e.message || 'Error al cargar estudiantes';
		} finally {
			loadingEstudiantes = false;
		}
	}

	async function cargarEstudiantesDelCurso() {
		try {
			// Cargar estudiantes del curso (paginado) para resolver nombres
			const resp = await studentService.getAll(1, 200, { curso_id: cursoId });
			const lista = resp.data || [];
			const map = new Map<string, Student>();
			lista.forEach((s: any) => {
				const id = s._id || s.id;
				if (id) map.set(String(id), s as Student);
			});
			estudiantesById = map;
		} catch (e) {
			console.error('Error cargando estudiantes del curso:', e);
			estudiantesById = new Map();
		}
	}

	function formatEstadoBadge(estado: string): string {
		const map: Record<string, string> = {
			activo: 'bg-green-100 text-green-700 border-green-200',
			suspendido: 'bg-amber-100 text-amber-700 border-amber-200',
			completado: 'bg-blue-100 text-blue-700 border-blue-200',
			cancelado: 'bg-gray-100 text-gray-700 border-gray-200',
			retirado: 'bg-red-100 text-red-700 border-red-200'
		};
		return map[estado] || 'bg-gray-100 text-gray-700 border-gray-200';
	}

	function nombreCompleto(e: any): string {
		// F-DASHBOARD-R10-FIX2 (2026-08-06): resolver nombre desde el map de
		// estudiantes del curso (cargado por cargarEstudiantesDelCurso()).
		// El endpoint /enrollments/course/{id} NO popula el estudiante.
		const id = e.estudiante_id || e.student?._id || e.student?.id;
		const s = id ? estudiantesById.get(String(id)) : null;
		if (s) {
			// Cast a any porque la interfaz Student en TS no incluye `apellido`
			// pero el backend SI lo retorna (campos separados en la BD).
			const sa = s as any;
			const n = s.nombre || '';
			const a = sa.apellido || '';
			const full = `${n} ${a}`.trim();
			if (full) return full;
		}
		// Fallback: si el embed existe (futuro populate del backend)
		const emb = e.student || e.estudiante || {};
		const embA = emb as any;
		const n = emb.nombre || e.estudiante_nombre || '';
		const a = embA.apellido || e.estudiante_apellido || '';
		return `${n} ${a}`.trim() || '(sin nombre)';
	}

	function carnetEstudiante(e: any): string {
		const id = e.estudiante_id || e.student?._id || e.student?.id;
		const s = id ? estudiantesById.get(String(id)) : null;
		if (s?.carnet) return s.carnet;
		const emb = e.student || e.estudiante || {};
		return emb.carnet || e.estudiante_carnet || '?';
	}

	// F-FIX-DUPLICADO-RESUMEN (2026-08-16): antes esto se llamaba tanto en
	// onMount() como en este $effect(), y $effect ya corre una vez al montar
	// (ademas de cada vez que cambia cursoId) — resultaba en 2x llamadas a
	// /enrollments/stats/resumen y /students/ por cada tarjeta de programa en
	// el dashboard. $effect solo alcanza para ambos casos.
	$effect(() => {
		if (cursoId) {
			cargarResumen();
			cargarEstudiantesDelCurso();
		}
	});
</script>

<div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
	<header class="flex items-center justify-between mb-3">
		<div>
			<h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
				Resumen de Inscritos
			</h3>
			{#if cursoNombre}
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
					{cursoCodigo ? `${cursoCodigo} · ` : ''}{cursoNombre}
				</p>
			{/if}
		</div>
		<button
			type="button"
			onclick={() => cargarResumen()}
			disabled={loading}
			class="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
		>
			{loading ? 'Cargando...' : 'Refrescar'}
		</button>
	</header>

	{#if error}
		<div class="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2 mb-3">
			{error}
		</div>
	{/if}

	{#if loading && !resumen}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			{#each Array(4) as _}
				<div class="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
			{/each}
		</div>
	{:else if resumen}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<!-- Card: Inscritos (Total) -->
			<button
				type="button"
				onclick={() => verDetalle('todos')}
				class="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 transition-all hover:scale-[1.02] hover:shadow-md text-left
					{categoriaActiva === 'todos' ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 dark:border-gray-700'}"
			>
				<p class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Inscritos</p>
				<p class="text-2xl font-black text-gray-900 dark:text-white mt-1">{resumen.total_inicial}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Total del programa</p>
			</button>

			<!-- Card: Activos -->
			<button
				type="button"
				onclick={() => verDetalle('activos')}
				class="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 transition-all hover:scale-[1.02] hover:shadow-md text-left
					{categoriaActiva === 'activos' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200 dark:border-green-900'}"
			>
				<p class="text-xs uppercase tracking-wider text-green-700 dark:text-green-400 font-semibold">Activos</p>
				<p class="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{resumen.activos}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
					{resumen.pendientes_pago > 0
						? `+${resumen.pendientes_pago} pendiente pago`
						: 'Cursando actualmente'}
				</p>
			</button>

			<!-- Card: Congelados (ISSUE R10: solo congelado, no pasivo/abandono) -->
			<button
				type="button"
				onclick={() => verDetalle('congelados')}
				class="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 transition-all hover:scale-[1.02] hover:shadow-md text-left
					{categoriaActiva === 'congelados' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200 dark:border-amber-900'}"
			>
				<p class="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Congelados</p>
				<p class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{resumen.pasivos?.congelado ?? 0}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
					Suspendidos con carta
				</p>
			</button>

			<!-- Card: Módulos Completados (ISSUE R10: "completado" = módulo académico cerrado) -->
			<button
				type="button"
				onclick={() => verDetalle('completados')}
				class="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 transition-all hover:scale-[1.02] hover:shadow-md text-left
					{categoriaActiva === 'completados' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-200 dark:border-blue-900'}"
			>
				<p class="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">Completados</p>
				<p class="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{resumen.completados}</p>
				<p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
					Terminaron el programa
				</p>
			</button>
		</div>

		<!-- Drill-down: lista de estudiantes -->
		{#if categoriaActiva}
			<div class="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<header class="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
					<h4 class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
						Detalle: {categoriaActiva === 'todos' ? 'Todos los inscritos' :
							categoriaActiva === 'activos' ? 'Estudiantes activos' :
							categoriaActiva === 'congelados' ? 'Estudiantes congelados' :
							'Estudiantes que completaron'}
						({estudiantes.length})
					</h4>
					<button
						type="button"
						onclick={() => { categoriaActiva = null; estudiantes = []; }}
						class="text-xs text-gray-500 hover:text-gray-700"
					>
						Cerrar ✕
					</button>
				</header>

				{#if loadingEstudiantes}
					<div class="p-4 text-center text-xs text-gray-500">
						Cargando estudiantes...
					</div>
				{:else if errorEstudiantes}
					<div class="p-4 text-xs text-red-600">
						{errorEstudiantes}
					</div>
				{:else if estudiantes.length === 0}
					<div class="p-4 text-center text-xs text-gray-500">
						No hay estudiantes en esta categoría
					</div>
				{:else}
					<div class="max-h-64 overflow-y-auto">
						<table class="w-full text-xs">
							<thead class="bg-gray-50 dark:bg-gray-900/30 sticky top-0">
								<tr>
									<th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Carnet</th>
									<th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Nombre</th>
									<th class="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Estado</th>
									<th class="px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400">Saldo</th>
								</tr>
							</thead>
							<tbody>
								{#each estudiantes as e}
									<tr class="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
										<td class="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{carnetEstudiante(e)}</td>
										<td class="px-3 py-1.5 text-gray-800 dark:text-gray-200">{nombreCompleto(e)}</td>
										<td class="px-3 py-1.5">
											<span class="px-2 py-0.5 text-[10px] font-semibold rounded border {formatEstadoBadge(e.estado)}">
												{e.estado}
											</span>
										</td>
										<td class="px-3 py-1.5 text-right font-mono text-gray-700 dark:text-gray-300">
											Bs {(e.saldo_pendiente ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
