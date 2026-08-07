<script lang="ts">
	import { onMount } from 'svelte';
	import { dashboardService } from '$lib/services';
	import type { DashboardStats, DashboardCourseBreakdown } from '$lib/services/dashboard.service';
	import { UsersIcon, ClipboardIcon, TagIcon, ChartBarIcon } from '$lib/icons/outline';
	import { CreditCardIcon } from '$lib/icons/solid';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { goto } from '$app/navigation';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';
	import { userStore } from '$lib/stores/userStore';
	import { get } from 'svelte/store';
	import DocumentValidationModal from '$lib/components/ui/DocumentValidationModal.svelte';
	import { FileTextIcon } from '$lib/icons/outline';
	// F-COBRANZA-041 (2026-07-22): tarjetas KPI de inscritos movidas de
	// /app/enrollments al Dashboard (Kevin: "deberian salir en el dashboard
	// no en inscripciones").
	import KpiInscritosCards from '$lib/components/dashboard/KpiInscritosCards.svelte';
	// F-DASHBOARD-R9 (2026-08-05 20:40, Kevin): KPI por programa con drill-down.
	import KpiInscritosPorPrograma from '$lib/components/dashboard/KpiInscritosPorPrograma.svelte';

	// F-PERF-DASHBOARD-V2 (2026-08-06, Kevin): UN SOLO request al backend.
	// Antes: 9 llamadas en paralelo (students, courses, enrollments, payments,
	// dashboard/stats, payments/resumen-economico, enrollments/stats/resumen,
	// cuentas-por-cobrar/resumen-reducido, pending docs) -> 8.6s cold.
	// Ahora: 1 sola llamada a /dashboard/v2 -> ~1-2s cold, <50ms hot.
	// El backend devuelve TODO consolidado:
	//   stats + courseBreakdown + resumenInscritos + resumenEconomico
	//   + cxcResumen + recentEnrollments + recentPayments + pendingDocumentsCount

	// ROLES QUE VEN INSCRITOS: todos los administrativos (excluye student).
	const ROLES_QUE_VEN_INSCRITOS = ['superadmin', 'admin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'];
	const ROLES_ECONOMICOS_BASE = ['superadmin', 'admin', 'cobranza', 'mae'];
	const ROLES_QUE_VEN_PAGOS = ['superadmin', 'admin', 'mae', 'cobranza', 'cpd'];

	$: currentRole = $userStore.role || '';
	$: esCoordinadorFinanciero = $userStore.user?.subtipo_coordinador === 'financiero';
	// F-PERF-DASHBOARD-V2: resumenEconomico y cxcResumen vienen del response v2.
	// Si vienen con datos (no null) y el rol es economico, mostrarlos.
	$: verResumenEconomico = (ROLES_ECONOMICOS_BASE.includes(currentRole) || (currentRole === 'coordinador' && esCoordinadorFinanciero)) && resumenEconomico != null;
	// F-PERF-DASHBOARD-V2: puedeVerPagos para badges de pagos en listas
	$: puedeVerPagos = (ROLES_QUE_VEN_PAGOS.includes(currentRole) || (currentRole === 'coordinador' && esCoordinadorFinanciero)) && recentPayments.length >= 0;
	// F-COBRANZA-041: KPI inscritos visible para roles administrativos.
	$: verKpiInscritos = ROLES_QUE_VEN_INSCRITOS.includes(currentRole) && resumenInscritos != null;

	// Perfiles segmentados (cobranza/encargado con cursos_asignados) NO necesitan
	// el "Desglose por Curso": su vista ya está acotada a sus cursos, así que sería
	// redundante. Solo los perfiles globales (superadmin/admin/mae sin cursos) lo ven.
	$: cursosAsignados = $userStore.user?.cursos_asignados ?? [];
	$: esSegmentado = cursosAsignados.length > 0;

	let loading = true;
	let stats: DashboardStats = {
		students: { total: 0, active: 0 },
		courses: { total: 0, active: 0 },
		enrollments: { total: 0, active: 0 },
		payments: { total: 0, pending: 0, revenue: 0 }
	};
	let resumenEconomico: any = null;       // viene del v2
	let cxcResumen: any = null;             // viene del v2
	let resumenInscritos: any = null;       // viene del v2
	let recentEnrollments: any[] = [];      // viene del v2
	let recentPayments: any[] = [];         // viene del v2
	let pendingDocumentsCount = 0;          // viene del v2

	interface CourseBreakdown {
		id: string;
		nombre: string;
		codigo: string;
		tipo: string;
		modalidad: string;
		estado?: string;
		activo: boolean;
		inscritos: number;
		inscritosActivos: number;
		ingresos: number;
		saldoPendiente: number;
		pagosPendientes: number;
		// F-DASHBOARD-POR-PROGRAMA (2026-08-05, Kevin): 4 indicadores
		// financieros por programa, vienen del backend /dashboard/stats.
		ingreso_matricula: number;
		ingreso_colegiatura: number;
		total_ingresos: number;
		por_cobrar: number;
	}
	let courseBreakdown: CourseBreakdown[] = [];
	let groupedByType: Record<string, CourseBreakdown[]> = {};
	let expandedGroups: Set<string> = new Set();

	let showDocumentModal = false;

	const TYPE_ORDER = ['maestría', 'doctorado', 'diplomado', 'curso', 'taller', 'seminario', 'otro'];

	const TYPE_LABELS: Record<string, string> = {
		'maestría': 'Maestrías',
		'doctorado': 'Doctorados',
		'diplomado': 'Diplomados',
		'curso': 'Cursos',
		'taller': 'Talleres',
		'seminario': 'Seminarios',
		'otro': 'Otros'
	};

	const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; accent: string }> = {
		'maestría':  { bg: 'bg-purple-50 dark:bg-purple-900/20',  text: 'text-purple-700 dark:text-purple-300',  border: 'border-purple-200 dark:border-purple-800',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', accent: 'bg-purple-400' },
		'doctorado': { bg: 'bg-indigo-50 dark:bg-indigo-900/20',  text: 'text-indigo-700 dark:text-indigo-300',  border: 'border-indigo-200 dark:border-indigo-800',  badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', accent: 'bg-indigo-400' },
		'diplomado': { bg: 'bg-blue-50 dark:bg-blue-900/20',      text: 'text-blue-700 dark:text-blue-300',      border: 'border-blue-200 dark:border-blue-800',      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', accent: 'bg-blue-400' },
		'curso':     { bg: 'bg-teal-50 dark:bg-teal-900/20',      text: 'text-teal-700 dark:text-teal-300',      border: 'border-teal-200 dark:border-teal-800',      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', accent: 'bg-teal-400' },
		'taller':    { bg: 'bg-orange-50 dark:bg-orange-900/20',  text: 'text-orange-700 dark:text-orange-300',  border: 'border-orange-200 dark:border-orange-800',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', accent: 'bg-orange-400' },
		'seminario': { bg: 'bg-pink-50 dark:bg-pink-900/20',      text: 'text-pink-700 dark:text-pink-300',      border: 'border-pink-200 dark:border-pink-800',      badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', accent: 'bg-pink-400' },
		'otro':      { bg: 'bg-gray-50 dark:bg-gray-800',          text: 'text-gray-700 dark:text-gray-300',      border: 'border-gray-200 dark:border-gray-700',      badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', accent: 'bg-gray-400' }
	};

	function getTypeStyle(tipo: string) {
		return TYPE_COLORS[tipo] ?? TYPE_COLORS['otro'];
	}

	function toggleGroup(tipo: string) {
		if (expandedGroups.has(tipo)) {
			expandedGroups.delete(tipo);
		} else {
			expandedGroups.add(tipo);
		}
		expandedGroups = new Set(expandedGroups);
	}

	function buildGrouped(courses: CourseBreakdown[]) {
		const grouped: Record<string, CourseBreakdown[]> = {};
		for (const c of courses) {
			const key = c.tipo ?? 'otro';
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(c);
		}
		return grouped;
	}

	onMount(async () => {
		try {
			// F-PERF-DASHBOARD-V2 (2026-08-06, Kevin): UNA SOLA LLAMADA al backend.
			// Antes: 9 requests en paralelo que sumaban ~8.6s en el peor caso.
			// Ahora: 1 request a /dashboard/v2 que devuelve TODO consolidado.
			// Cold cache: ~1-2s esperado. Hot cache: <50ms.
			const v2 = await dashboardService.getV2();

			stats = v2.stats;
			// F-PERF-DASHBOARD-V2 (2026-08-06, Kevin): el backend v2 ya devuelve
			// courseBreakdown con los 4 indicadores. Mapeamos al shape local.
			courseBreakdown = (v2.courseBreakdown ?? []).map((c: any) => ({
				id: c.id,
				nombre: c.nombre,
				codigo: c.codigo,
				tipo: c.tipo,
				modalidad: c.modalidad,
				estado: c.estado,
				activo: c.activo,
				inscritos: c.inscritos ?? 0,
				inscritosActivos: c.inscritos ?? 0,
				ingresos: c.total_ingresos ?? 0,
				saldoPendiente: c.por_cobrar ?? 0,
				pagosPendientes: 0,
				ingreso_matricula: c.ingreso_matricula ?? 0,
				ingreso_colegiatura: c.ingreso_colegiatura ?? 0,
				total_ingresos: c.total_ingresos ?? 0,
				por_cobrar: c.por_cobrar ?? 0,
			}));
			groupedByType = buildGrouped(courseBreakdown);
			expandedGroups = new Set(Object.keys(groupedByType));

			resumenInscritos = v2.resumenInscritos;
			resumenEconomico = v2.resumenEconomico;
			cxcResumen = v2.cxcResumen;
			recentEnrollments = v2.recentEnrollments ?? [];
			recentPayments = v2.recentPayments ?? [];
			pendingDocumentsCount = v2.pendingDocumentsCount ?? 0;

		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			loading = false;
		}
	});

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);
	}
</script>

<div class="space-y-8">

	{#if loading}
		<DashboardSkeleton />
	{:else}
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  			<Heading level="h1">Dashboard</Heading>
			
			{#if ['encargado_curso', 'cpd', 'admin', 'superadmin', 'coordinador'].includes(currentRole)}
				<button 
					onclick={() => showDocumentModal = true}
					class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 text-gray-700 dark:text-gray-200 font-medium text-sm w-full sm:w-auto justify-center"
				>
					<FileTextIcon class="size-5 text-amber-500" />
					Validación de Documentos
					{#if pendingDocumentsCount > 0}
						<span class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full ml-1">
							{pendingDocumentsCount}
						</span>
					{/if}
				</button>
			{/if}
		</div>

		<DocumentValidationModal
			isOpen={showDocumentModal}
			onClose={() => showDocumentModal = false}
		/>

		<!-- US-007 (2026-08-03): banner de alerta "X estudiantes con módulos
		     pendiente(s) de iniciar" eliminado. Kevin: "eliminar mensaje amarillo".
		     Razón: al inicio del ciclo, TODOS los estudiantes están en
		     "Pendiente de iniciar" (es el estado por defecto de un módulo
		     recién creado), así que el banner siempre mostraba el total absoluto
		     sin aportar señal accionable. Si en el futuro se quiere alertar
		     sobre módulos ATRASADOS (fecha_inicio vencida sin iniciado), que
		     sea un banner DIFERENTE y basado en una fecha, no en el conteo. -->

		<!-- ISSUE-P-DASHBOARD-COBRANZA: Resumen Económico (Cobranza / Coordinador Financiero / MAE / Admin).
		     Incluye la matrícula como ingreso contable aunque Cobranza no la apruebe.
		     F-DASHBOARD-POR-PROGRAMA (2026-08-05, Kevin): renombrado a "Resumen
		     Económico General" para diferenciarlo del nuevo "Ingresos por Programa"
		     agregado debajo. Kevin en reunión: "el resumen tengo que mantenerlo
		     así como está... voy a cambiar los títulos, por ejemplo poner resumen
		     económico general".
		     F-DASHBOARD-V2 (2026-08-05 17:30, Kevin): cards reducidas a 4 (sin
		     'Cobros Pendientes' ni 'Total Inscritos') y dispuestas en 1 línea
		     (xl:grid-cols-4). Kevin: "ya no sería necesario, habría que eliminar
		     esas dos tarjetas y que queden las cuatro principales más reducidas
		     de tamaño para que entren en una misma línea". -->
		{#if verResumenEconomico && resumenEconomico}
			<div>
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Resumen Económico General</h2>
					<a href="/app/reports" class="text-xs sm:text-sm text-primary-600 hover:text-primary-500 hover:scale-105 transition-transform">Ver reportes</a>
				</div>

				<div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
					<!-- Ingreso por Matrícula -->
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 flex items-center justify-between min-w-0">
						<div class="flex-1 min-w-0 mr-2">
							<p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Ingreso por Matrícula</p>
							<p class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-1 truncate" title={formatCurrency(resumenEconomico.ingreso_matricula)}>
								{formatCurrency(resumenEconomico.ingreso_matricula)}
							</p>
						</div>
						<div class="p-2.5 bg-uagrm-blue rounded-full text-white shrink-0">
							<svg class="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
						</div>
					</div>

					<!-- Ingreso por Colegiatura -->
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 flex items-center justify-between min-w-0">
						<div class="flex-1 min-w-0 mr-2">
							<p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Ingreso por Colegiatura</p>
							<p class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-1 truncate" title={formatCurrency(resumenEconomico.ingreso_colegiatura)}>
								{formatCurrency(resumenEconomico.ingreso_colegiatura)}
							</p>
						</div>
						<div class="p-2.5 bg-primary-600 rounded-full text-white shrink-0">
							<svg class="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
						</div>
					</div>

					<!-- Total Ingresos -->
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 flex items-center justify-between min-w-0">
						<div class="flex-1 min-w-0 mr-2">
							<p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Ingresos</p>
							<p class="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mt-1 truncate" title={formatCurrency(resumenEconomico.total_ingresos)}>
								{formatCurrency(resumenEconomico.total_ingresos)}
							</p>
						</div>
						<div class="p-2.5 bg-green-600 rounded-full text-white shrink-0">
							<svg class="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						</div>
					</div>

					<!-- Por Cobrar -->
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 flex items-center justify-between min-w-0">
						<div class="flex-1 min-w-0 mr-2">
							<p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Por Cobrar</p>
							<p class="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400 mt-1 truncate" title={formatCurrency(resumenEconomico.por_cobrar)}>
								{formatCurrency(resumenEconomico.por_cobrar)}
							</p>
						</div>
						<div class="p-2.5 bg-orange-500 rounded-full text-white shrink-0">
							<svg class="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- F-CUENTAS-POR-COBRAR (2026-07-29): tarjeta con CxC real vs estimada.
		     Es la información que la contadora y el consejo facultativo observaron
		     que faltaba (reunión 2026-07-29): la CxC real (a la fecha) solo suma
		     los módulos que ya están en curso. La diferencia entre el estimado y
		     el real se devenga recién cuando Sandra/Rocío inicia un módulo. -->
		<!-- US-004 v5 (2026-08-04): sección de Cuentas por Cobrar ELIMINADA del
		     dashboard por orden de Kevin. Sigue disponible en /app/reports/cuentas-por-cobrar
		     (el modal completo con desglose por programa). -->

		<!-- F-COBRANZA-041 (2026-07-22): KPI de inscritos movido de /app/enrollments al Dashboard.
		     F-DASHBOARD-V2 (2026-08-05 17:30, Kevin): seccion KpiInscritosCards
		     ELIMINADA por completo. Hay una ISU pendiente para cambiar esto. -->

		<!-- Stats Grid -->
		<!-- FIX-DASH-001: Eliminadas las 3 tarjetas (Estudiantes, Cursos, Inscripciones) que eran redundantes
		     con el Resumen Económico. Ahora solo queda la tarjeta de Ingresos (condicional) -->
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
			<!-- La tarjeta "Ingresos" es redundante para roles económicos (ya ven
			     "Total Ingresos" en el Resumen Económico, y esta muestra solo los
			     pagos filtrados por rol, lo que confunde). Se oculta para ellos.
				 NOTA: Solo se muestra si el usuario TIENE PERMISOS para ver pagos (ej. CPD) -->
			{#if !verResumenEconomico && puedeVerPagos}
			<a href="/app/payments" class="block">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg min-w-0">
					<div class="flex-1 min-w-0 mr-3">
						<p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Ingresos</p>
						<p class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate" title={formatCurrency(stats.payments?.revenue ?? 0)}>
							{formatCurrency(stats.payments?.revenue ?? 0)}
						</p>
						<p class="text-[10px] sm:text-xs text-yellow-600 mt-1 truncate">{stats.payments?.pending ?? 0} Pendientes</p>
					</div>
					<div class="p-3 bg-primary-600 rounded-full text-white shrink-0">
						<CreditCardIcon class="size-6 sm:size-8" />
					</div>
				</div>
			</a>
			{/if}
		</div>

		<!-- F-DASHBOARD-V2 (2026-08-05 17:30, Kevin): la seccion "Ingresos por
		     Programa" que estaba aca fue ELIMINADA. Sus 4 cards financieras
		     (Matrícula, Colegiatura, Total, Por Cobrar) se movieron DENTRO
		     de cada item del accordion "Desglose por Programa" mas abajo. -->

		<!-- Program Breakdown Section (oculto para perfiles segmentados por programa) -->
		{#if !esSegmentado}
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Desglose por Programa</h2>
				<a href="/app/courses" class="text-sm text-primary-600 hover:text-primary-500 hover:scale-105 transition-transform">Ver programas</a>
			</div>

			{#if courseBreakdown.length === 0}
				<Card>
					<p class="text-center text-gray-500 py-6">No hay cursos registrados</p>
				</Card>
			{:else}
				<div class="space-y-4">
					{#each [...TYPE_ORDER.filter(t => groupedByType[t]), ...Object.keys(groupedByType).filter(t => !TYPE_ORDER.includes(t))] as tipo}
						{@const style = getTypeStyle(tipo)}
						{@const group = groupedByType[tipo]}
						{@const isOpen = expandedGroups.has(tipo)}
						{@const totalInscritos = group.reduce((s, c) => s + c.inscritos, 0)}
						{@const totalIngresos = group.reduce((s, c) => s + c.ingresos, 0)}
						{@const totalPendientes = group.reduce((s, c) => s + c.pagosPendientes, 0)}

						<div class={`rounded-xl border ${style.border} overflow-hidden shadow-sm`}>
							<!-- Accordion header -->
							<button
								type="button"
								onclick={() => toggleGroup(tipo)}
								class={`w-full flex items-center justify-between px-4 sm:px-6 py-4 ${style.bg} hover:brightness-95 transition-all min-w-0`}
							>
								<div class="flex items-center gap-2 sm:gap-3 flex-wrap flex-1 min-w-0 pr-4">
									<span class={`text-sm sm:text-base font-bold ${style.text} truncate`}>{TYPE_LABELS[tipo] ?? tipo}</span>
									<span class={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full ${style.badge} shrink-0`}>
										{group.length} {group.length === 1 ? 'curso' : 'cursos'}
									</span>
									<span class="hidden lg:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ml-1 truncate">
										<span>{totalInscritos} inscritos</span>
										{#if puedeVerPagos}
											<span>·</span>
											<span>{formatCurrency(totalIngresos)} recaudado</span>
											{#if totalPendientes > 0}<span>· <span class="text-yellow-600 font-medium">{totalPendientes} pend.</span></span>{/if}
										{/if}
									</span>
								</div>
								<svg class={`size-5 shrink-0 ${style.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>

							{#if isOpen}
								<div class="bg-gray-50 dark:bg-gray-900/30 p-4 sm:p-5 space-y-6">
									{#each group as course}
										<!-- Nombre del curso -->
										<div class="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
											<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
												<div class={`hidden sm:block w-1.5 h-6 rounded-full shrink-0 ${style.accent}`}></div>
												<p class="text-sm sm:text-base font-bold text-gray-900 dark:text-white line-clamp-2 flex-1">{course.nombre}</p>

												<div class="flex items-center gap-2 shrink-0">
													<span class="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600">{course.codigo}</span>
													<span class={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md uppercase tracking-wider ${course.activo ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
														{course.activo ? 'Activo' : 'Inactivo'}
													</span>
												</div>
											</div>

											<!-- F-DASHBOARD-V2 (2026-08-05 17:30, Kevin): 4 cards
											     financieras (Matrícula, Colegiatura, Total,
											     Por Cobrar) DENTRO de cada item del accordion.
											     Solo se muestran para roles económicos.
											     F-DASHBOARD-R9 (2026-08-05 20:40, Kevin):
											     reemplaza el card simple "Estudiantes" por
											     KpiInscritosPorPrograma con drill-down. -->
											{#if verResumenEconomico}
												<!-- 4 cards financieros -->
												<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pt-3 border-t border-gray-100 dark:border-gray-700">
													<div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
														<p class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Ingreso Matrícula</p>
														<p class="text-base font-bold text-gray-900 dark:text-white font-mono mt-1">{formatCurrency(course.ingreso_matricula)}</p>
													</div>
													<div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
														<p class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Ingreso Colegiatura</p>
														<p class="text-base font-bold text-gray-900 dark:text-white font-mono mt-1">{formatCurrency(course.ingreso_colegiatura)}</p>
													</div>
													<div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
														<p class="text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 font-semibold">Total Ingresos</p>
														<p class="text-base font-bold text-green-600 dark:text-green-400 font-mono mt-1">{formatCurrency(course.total_ingresos)}</p>
													</div>
													<div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3">
														<p class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Por Cobrar</p>
														<p class="text-base font-bold text-orange-600 dark:text-orange-400 font-mono mt-1">{formatCurrency(course.por_cobrar)}</p>
													</div>
												</div>

												<!-- F-DASHBOARD-R9: KPI inscritos por programa con drill-down.
												     Click en una card muestra lista de estudiantes de esa categoria. -->
												<KpiInscritosPorPrograma
													cursoId={course.id}
													cursoNombre={course.nombre}
													cursoCodigo={course.codigo}
												/>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
		{/if}

	{/if}
</div>
