<script lang="ts">
	/**
	 * /app/academico/modulos — Gestión de Módulos (vista staff)
	 * ===========================================================
	 * F-MODAL-GESTION-MODULOS (2026-08-03, Kevin): vista centralizada para
	 * que el staff (admin/superadmin/cpd/coordinador/encargado_curso) pueda
	 * ver todos los enrollments activos con su progreso de módulos y abrir
	 * el GestionModulosModal para iniciar/cerrar/revertir módulos.
	 *
	 * - Filtros: por curso y por estado (todos / con módulos iniciados / finalizados)
	 * - Tabla con: estudiante, curso, progreso (finalizados/total), CxC, estado
	 * - Click en una fila abre el GestionModulosModal
	 *
	 * RBAC: staff (admin/superadmin/cpd/coordinador/encargado_curso/mae)
	 */
	import { onMount } from 'svelte';
	import { enrollmentService, courseService } from '$lib/services';
	import type { Enrollment, Course } from '$lib/interfaces';
	import type { PaginatedResponse } from '$lib/interfaces/response.interface';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import GestionModulosModal from '$lib/components/ui/GestionModulosModal.svelte';
	import {
		RefreshIcon,
		SearchIcon,
		ExclamationIcon,
		CheckIcon,
	} from '$lib/icons/outline';
	import { BookIcon } from '$lib/icons/solid';
	import { formatCurrency, formatDate } from '$lib/utils';

	// ========================================================================
	// STATE
	// ========================================================================

	let loading = $state(true);
	let enrollments = $state<Enrollment[]>([]);
	let courses = $state<Course[]>([]);
	let coursesMap = $state<Record<string, string>>({});

	let filterCurso = $state('');
	let filterEstado = $state('todos'); // todos | en_curso | finalizados | sin_iniciar
	let search = $state('');
	// F-FIX-BUSQUEDA-DEBOUNCE (2026-08-16): `search` es lo que se va tipeando y
	// `searchAplicado` es lo que realmente filtra. Sin esto, cada tecla
	// recalculaba el $derived sobre cientos de inscripciones y la escritura se
	// sentia trabada. 250ms es el mismo criterio que ya usan /app/students y
	// /app/enrollments.
	let searchAplicado = $state('');
	let debounceBusqueda: any;

	function alTipearBusqueda() {
		clearTimeout(debounceBusqueda);
		debounceBusqueda = setTimeout(() => {
			searchAplicado = search;
		}, 250);
	}

	let modalOpen = $state(false);
	let modalEnrollment: Enrollment | null = $state(null);
	let modalLoading = $state(false);

	// Usuario actual (para RBAC)
	const user = $derived($userStore.user);
	const userRole = $derived(user?.rol || user?.role || '');

	// ========================================================================
	// CARGA DE DATOS
	// ========================================================================

	/**
	 * Trae TODAS las paginas de un listado paginado, no solo la primera.
	 *
	 * Existe porque el buscador de esta pantalla filtra en memoria: si la
	 * carga se queda corta, los registros que faltan son invisibles para la
	 * busqueda y el usuario no se entera. Ver F-FIX-BUSQUEDA-TOPE.
	 *
	 * Si se alcanza el tope de seguridad, AVISA en vez de recortar callado.
	 */
	async function traerTodo<T>(
		pedir: (page: number) => Promise<any>,
		etiqueta: string,
		maximo = 10000
	): Promise<T[]> {
		const acumulado: T[] = [];
		let page = 1;
		let hayMas = true;
		while (hayMas) {
			let resp: any;
			try {
				resp = await pedir(page);
			} catch (e) {
				// Si falla la primera pagina no hay nada que mostrar; si falla una
				// posterior, al menos avisamos que la lista quedo incompleta.
				if (page === 1) return [];
				alert('error', `Se cargaron ${acumulado.length} ${etiqueta}, pero la lista quedó incompleta.`);
				return acumulado;
			}
			acumulado.push(...((resp?.data as T[]) || []));
			hayMas = Boolean(resp?.meta?.hasNextPage);
			page += 1;
			if (acumulado.length >= maximo) {
				alert(
					'warning',
					`Se alcanzó el límite de ${maximo} ${etiqueta}. La búsqueda puede no encontrar todo; conviene filtrar por programa.`
				);
				break;
			}
		}
		return acumulado;
	}

	async function loadData() {
		loading = true;
		try {
			// Cargar cursos y enrollments en paralelo
			// NOTA: ambos endpoints devuelven PaginatedResponse<{data: T[], meta: ...}>
			// así que extraemos .data para obtener el array.
			// F-FIX-BUSQUEDA-TOPE (2026-08-16): antes esto pedia UNA sola pagina
			// con el tope del backend (500 enrollments / 100 cursos) y se
			// quedaba con eso. Como el buscador de esta pantalla filtra EN
			// MEMORIA sobre lo que se cargo, cualquier registro por encima del
			// tope se volvia invisible: el usuario buscaba un alumno que existe
			// y no aparecia, sin ningun aviso de que la lista estaba recortada.
			//
			// Hoy no se notaba (239 inscripciones activas, 23 cursos), pero la
			// carga historica pendiente son 130 + 480 alumnos — cruzaria el tope
			// de 500 y la busqueda empezaria a fallar en silencio.
			//
			// Ahora se pagina hasta traer todo. El tope de seguridad corta en
			// 10.000 registros y AVISA en vez de recortar callado.
			const [coursesResp, enrollmentsResp] = await Promise.all([
				traerTodo<Course>((p) => courseService.getAll(p, 100), 'cursos'),
				traerTodo<Enrollment>(
					(p) => enrollmentService.getAll(p, 500, { estado: 'activo' }),
					'inscripciones'
				),
			]);
			courses = coursesResp;
			enrollments = enrollmentsResp;

			// Mapa de cursos para lookup rápido
			const map: Record<string, string> = {};
			for (const c of courses) {
				const id = c._id || c.id;
				if (id) map[String(id)] = c.nombre_programa || `Curso ${id}`;
			}
			coursesMap = map;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar la lista de inscripciones');
		} finally {
			loading = false;
		}
	}

	onMount(loadData);

	// ========================================================================
	// COMPUTED
	// ========================================================================

	function getCursoNombre(cursoId: string): string {
		return coursesMap[cursoId] || `Curso ${cursoId}`;
	}

	function getModulosStats(e: Enrollment): { finalizados: number; enCurso: number; total: number; progreso: number } {
		const total = e.modulos?.length || 0;
		if (total === 0) return { finalizados: 0, enCurso: 0, total: 0, progreso: 0 };
		const finalizados = e.modulos.filter((m: any) => m.finalizado_en).length;
		const enCurso = e.modulos.filter((m: any) => m.iniciado_en && !m.finalizado_en).length;
		const progreso = Math.round((finalizados / total) * 100);
		return { finalizados, enCurso, total, progreso };
	}

	const filtered = $derived.by(() => {
		// El backend ya filtra por estado=activo, pero por si acaso filtramos
		// también del lado del cliente (defense in depth).
		return enrollments.filter((e) => {
			if (e.estado && e.estado !== 'activo') return false;
			// Filtro por curso
			if (filterCurso && String(e.curso_id) !== String(filterCurso)) return false;
			// Filtro por estado de módulos
			if (filterEstado !== 'todos') {
				const stats = getModulosStats(e);
				if (filterEstado === 'en_curso' && stats.enCurso === 0) return false;
				if (filterEstado === 'finalizados' && stats.finalizados === 0) return false;
				if (filterEstado === 'sin_iniciar' && stats.enCurso > 0) return false;
				if (filterEstado === 'completados' && stats.finalizados < stats.total) return false;
			}
			// Filtro por búsqueda (estudiante)
			// F-FIX-MODULOS-ESTUDIANTE (2026-08-16): antes leía `e.estudiante?.nombre`
			// y compañía. Ese objeto anidado NO EXISTE: GET /enrollments/ devuelve los
			// campos joineados PLANOS (`estudiante_nombre`, `estudiante_registro`,
			// `estudiante_ci` — ver F-FIX-DESCONOCIDO-ENROLLMENTS en
			// schemas/enrollment.py). Como `est` siempre era undefined, `matches`
			// quedaba falsy y este filtro descartaba TODAS las filas: escribir
			// cualquier cosa en el buscador vaciaba la tabla.
			if (searchAplicado.trim()) {
				const s = searchAplicado.trim().toLowerCase();
				const matches =
					(e.estudiante_nombre && e.estudiante_nombre.toLowerCase().includes(s)) ||
					(e.estudiante_registro && String(e.estudiante_registro).includes(s)) ||
					(e.estudiante_ci && String(e.estudiante_ci).includes(s));
				if (!matches) return false;
			}
			return true;
		});
	});

	// Estadísticas globales
	const stats = $derived.by(() => {
		// El backend ya filtra por estado=activo.
		const activos = enrollments.filter((e) => !e.estado || e.estado === 'activo');
		let conModulosEnCurso = 0;
		let conModulosCompletados = 0;
		let totalModulos = 0;
		let modulosFinalizados = 0;
		for (const e of activos) {
			const s = getModulosStats(e);
			if (s.enCurso > 0) conModulosEnCurso++;
			if (s.finalizados === s.total && s.total > 0) conModulosCompletados++;
			totalModulos += s.total;
			modulosFinalizados += s.finalizados;
		}
		return {
			activos: activos.length,
			conModulosEnCurso,
			conModulosCompletados,
			totalModulos,
			modulosFinalizados,
			progresoGlobal: totalModulos > 0 ? Math.round((modulosFinalizados / totalModulos) * 100) : 0,
		};
	});

	// ========================================================================
	// ACCIONES
	// ========================================================================

	async function abrirModal(e: Enrollment) {
		modalLoading = true;
		modalOpen = true;
		try {
			// Cargar la versión fresca del enrollment con sus módulos
			const fresh = await enrollmentService.getById(String(e._id || e.id));
			modalEnrollment = fresh as Enrollment;
		} catch (err: any) {
			alert('error', err?.message || 'No se pudo cargar la inscripción');
			modalOpen = false;
		} finally {
			modalLoading = false;
		}
	}

	function cerrarModal() {
		modalOpen = false;
		modalEnrollment = null;
	}

	function onEnrollmentUpdated(updated: Enrollment) {
		// Actualizar la fila correspondiente en la tabla
		const idx = enrollments.findIndex((e) => String(e._id || e.id) === String(updated._id || updated.id));
		if (idx >= 0) {
			enrollments = [
				...enrollments.slice(0, idx),
				updated,
				...enrollments.slice(idx + 1),
			];
		}
	}
</script>


<svelte:head>
	<title>Módulos por Estudiante · KYC DataHub</title>
</svelte:head>
<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Gestión de Módulos</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Inicia, cierra o revierte módulos de cada inscripción. El ciclo es: Pendiente → En curso → Finalizado.
			</p>
		</div>
		<Button onclick={loadData} loading={loading} variant="secondary">
			{#snippet leftIcon()}<RefreshIcon class="size-5" />{/snippet}
			Refrescar
		</Button>
	</div>

	<!-- Estadísticas rápidas -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
		<Card variant="bordered" padding="sm">
			<p class="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wide">Inscritos activos</p>
			<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.activos}</p>
		</Card>
		<Card variant="bordered" padding="sm">
			<p class="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wide">Con módulos en curso</p>
			<p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.conModulosEnCurso}</p>
		</Card>
		<Card variant="bordered" padding="sm">
			<p class="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wide">Programas completados</p>
			<p class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.conModulosCompletados}</p>
		</Card>
		<Card variant="bordered" padding="sm">
			<p class="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wide">Módulos finalizados</p>
			<p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
				{stats.modulosFinalizados}<span class="text-base text-gray-400">/{stats.totalModulos}</span>
			</p>
		</Card>
		<Card variant="bordered" padding="sm">
			<p class="text-[10px] uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wide">Progreso global</p>
			<p class="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">{stats.progresoGlobal}%</p>
		</Card>
	</div>

	<!-- Filtros -->
	<Card variant="bordered" padding="md">
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
			<div>
				<label for="search" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buscar estudiante</label>
				<div class="relative">
					<SearchIcon class="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					<input
						id="search"
						type="text"
						bind:value={search}
						oninput={alTipearBusqueda}
						placeholder="Nombre, CI o registro..."
						class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
					/>
				</div>
			</div>
			<div>
				<label for="filterCurso" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Programa</label>
				<select
					id="filterCurso"
					bind:value={filterCurso}
					class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
				>
					<option value="">Todos los programas</option>
					{#each courses as c (c._id || c.id)}
						<option value={c._id || c.id}>{c.nombre_programa}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="filterEstado" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estado de módulos</label>
				<select
					id="filterEstado"
					bind:value={filterEstado}
					class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-surface text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
				>
					<option value="todos">Todos</option>
					<option value="en_curso">Con módulos en curso</option>
					<option value="finalizados">Con módulos finalizados</option>
					<option value="sin_iniciar">Sin iniciar ningún módulo</option>
					<option value="completados">Programa completo</option>
				</select>
			</div>
		</div>
		<div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
			Mostrando <strong>{filtered.length}</strong> de {enrollments.length} inscripciones activas
		</div>
	</Card>

	<!-- Tabla -->
	{#if loading}
		<Skeleton variant="table" columns={5} rows={10} />
	{:else if filtered.length === 0}
		<Card variant="bordered" padding="md">
			<div class="text-center py-12 text-gray-500 dark:text-gray-400">
				<ExclamationIcon class="size-12 mx-auto mb-3 opacity-50" />
				<p>No hay inscripciones que coincidan con los filtros.</p>
			</div>
		</Card>
	{:else}
		<div class="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
					<thead class="bg-gray-50 dark:bg-dark-background text-gray-600 dark:text-gray-300">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Estudiante</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Programa</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Progreso</th>
							<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Saldo</th>
							<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">Inscripción</th>
							<th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Acciones</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
						{#each filtered as e (e._id || e.id)}
							{@const stats = getModulosStats(e)}
							<tr class="hover:bg-gray-50 dark:hover:bg-dark-background/30 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{e.estudiante_nombre || `Estudiante ${e.estudiante_id}`}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400">
										{#if e.estudiante_registro}Reg: {e.estudiante_registro}{/if}
										{#if e.estudiante_ci} · CI: {e.estudiante_ci}{/if}
									</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
									{getCursoNombre(String(e.curso_id))}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[80px]">
											<div
												class="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all"
												style="width: {stats.progreso}%"
											></div>
										</div>
										<span class="text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300 min-w-[60px]">
											{stats.finalizados}/{stats.total}
										</span>
									</div>
									{#if stats.enCurso > 0}
										<p class="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
											{stats.enCurso} en curso
										</p>
									{/if}
								</td>
								<td class="px-4 py-3 text-right tabular-nums">
									<span class={e.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>
										{formatCurrency(e.saldo_pendiente)}
									</span>
									<p class="text-[10px] text-gray-500">de {formatCurrency(e.total_a_pagar)}</p>
								</td>
								<td class="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
									{e.fecha_inscripcion ? formatDate(e.fecha_inscripcion) : '—'}
								</td>
								<td class="px-4 py-3 text-center">
									<Button
										size="sm"
										variant="primary"
										onclick={() => abrirModal(e)}
										loading={modalLoading}
										ariaLabel="Gestionar módulos de {e.estudiante_nombre || e.estudiante_id}"
									>
										{#snippet leftIcon()}<BookIcon class="size-4" />{/snippet}
										Gestionar
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<!-- Modal centralizado de gestión de módulos (F-MODAL-GESTION-MODULOS 2026-08-03) -->
<GestionModulosModal
	isOpen={modalOpen}
	enrollment={modalEnrollment}
	onClose={cerrarModal}
	onUpdated={onEnrollmentUpdated}
/>
