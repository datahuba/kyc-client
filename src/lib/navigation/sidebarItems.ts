/**
 * F-REFACTOR-SIDEBAR (2026-07-31)
 * ==============================
 * Items del sidebar extraidos a un archivo separado.
 *
 * Antes: el array `navItems` vivia inline en Sidebar.svelte y ocupaba
 * ~300 lineas. Eso hacia el componente dificil de leer y bloquear el
 * versionado independiente (cada cambio de un item tocaba el archivo
 * del layout completo).
 *
 * Ahora: este archivo es la UNICA fuente de verdad para los items del
 * sidebar. Sidebar.svelte solo se ocupa del render, filtrado por rol y
 * estado.
 *
 * Para agregar/modificar/reordenar items: edita este archivo.
 * NO toques Sidebar.svelte a menos que cambies el comportamiento de
 * filtrado o render.
 */
import {
	UsersIcon,
	ClipboardIcon,
	TagIcon,
	KeyIcon,
	QrCodeIcon,
	FileTextIcon,
	AcademicCapIcon,
	ChartBarIcon,
	DocumentAddIcon,
	CollectionIcon,
	LoaderIcon,
	ExclamationIcon,
	BellIcon,
	EyeIcon,
	IdentificationIcon,
	UserIcon,
	MailIcon
} from '$lib/icons/outline';
import {
	BookIcon,
	CreditCardIcon,
	HomeIcon,
	CalendarIcon
} from '$lib/icons/solid';

// Tipos exportados
export interface NavigationItem {
	type: 'item';
	name: string;
	href: string;
	icon: any;
	roles: string[];
	loginTypes: ('admin' | 'academic')[];
	external?: boolean;
	target?: string;
	rel?: string;
}

export interface NavigationGroup {
	type: 'group';
	name: string;
	icon: any;
	roles: string[];
	loginTypes: ('admin' | 'academic')[];
	children: NavigationItem[];
}

export interface NavigationSpacer {
	type: 'spacer';
}

export type NavigationEntry = NavigationItem | NavigationGroup | NavigationSpacer;

// Items compartidos entre student/docente y staff
const sharedAcademicItems: NavigationItem[] = [
	{ type: 'item', name: 'Aula Virtual UAGRM', href: 'https://virtual.uagrm.edu.bo/postgrado/login/index.php', icon: AcademicCapIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },
	{ type: 'item', name: 'Certificados', href: '/app/certificates', icon: FileTextIcon, roles: ['student', 'admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador', 'docente'], loginTypes: ['academic', 'admin'] },
	{ type: 'item', name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student', 'docente'], loginTypes: ['academic'] },
	{ type: 'item', name: 'Mis Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['student'], loginTypes: ['academic'] },
	{ type: 'item', name: 'Mis Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['student'], loginTypes: ['academic'] },
	{ type: 'item', name: 'Mis Solicitudes', href: '/app/requests', icon: DocumentAddIcon, roles: ['student'], loginTypes: ['academic'] },
	{ type: 'item', name: 'Perfil de Notas UAGRM', href: 'https://perfil.uagrm.edu.bo/estudiantes/default.php', icon: ClipboardIcon, roles: ['student', 'docente'], loginTypes: ['academic'], external: true, target: '_blank', rel: 'noopener noreferrer' },
];

// Items de staff (admin/superadmin/mae/cpd/cobranza/encargado_curso/coordinador)
const staffAcademicGroup: NavigationGroup = {
	type: 'group',
	name: 'Académico',
	icon: AcademicCapIcon,
	roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador', 'docente'],
	loginTypes: ['admin'],
	children: [
		{ type: 'item', name: 'Calendario', href: '/app/courses/calendario', icon: CalendarIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador', 'docente'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Docentes', href: '/app/teachers', icon: AcademicCapIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		// F-MODAL-GESTION-MODULOS (2026-08-03, Kevin): vista centralizada de
		// gestión de módulos. Accesible desde el sidebar Académico.
		{ type: 'item', name: 'Módulos', href: '/app/academico/modulos', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Programas', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin', 'cpd', 'mae'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Validación de Notas', href: '/app/admin/grade-validation', icon: AcademicCapIcon, roles: ['cpd', 'admin', 'superadmin'], loginTypes: ['admin'] },
	]
};

const staffFinancialGroup: NavigationGroup = {
	type: 'group',
	name: 'Financiero',
	icon: CreditCardIcon,
	roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'coordinador'],
	loginTypes: ['admin'],
	children: [
		{ type: 'item', name: 'Cuentas por Cobrar', href: '/app/reports/cuentas-por-cobrar', icon: ChartBarIcon, roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'coordinador', 'encargado_curso'], loginTypes: ['admin'] },
		// F-CUENTAS-HISTORICAS (2026-08-16, Kevin): los programas historicos
		// salieron del Dashboard y de Cuentas por Cobrar; este es su expediente
		// aparte. Va justo despues de CxC porque es su contraparte.
		{ type: 'item', name: 'Cuentas Históricas', href: '/app/reports/cuentas-historicas', icon: ChartBarIcon, roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'coordinador', 'encargado_curso'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Deudores', href: '/app/payments/deudores', icon: ExclamationIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'cpd', 'coordinador'], loginTypes: ['admin'] },
		// F-2026-08-22-EC-PAGOS-READONLY (Kevin 2026-08-22): encargado_curso y coordinador
		// (financiero) ven Gestion de Pagos en modo SOLO LECTURA. Pueden ver y descargar
		// los pagos de SUS cursos asignados (filtro automatico del backend via
		// filtro_cursos_por_rol), pero NO pueden editar, crear, aprobar, rechazar,
		// ni eliminar pagos. El guard `coordinador no-financiero` del Sidebar.svelte
		// sigue ocultando esta entrada a coordinadores academico/investigacion.
		{ type: 'item', name: 'Gestión de Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Informes', href: '/app/informes', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Reportes de Caja', href: '/app/reports', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'coordinador'], loginTypes: ['admin'] },
	]
};

const staffEnrollmentsGroup: NavigationGroup = {
	type: 'group',
	name: 'Inscripciones',
	icon: ClipboardIcon,
	roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'],
	loginTypes: ['admin'],
	children: [
		{ type: 'item', name: 'Lista de Inscritos', href: '/app/enrollments', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Inscripción Individual', href: '/app/enrollments?new=1', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		// F-INSCRIPCION-LOTE (2026-07-31): wizard para matricular varios
		// estudiantes a un mismo programa en una sola operacion.
		{ type: 'item', name: 'Inscripción en Lote', href: '/app/enrollments/bulk', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'coordinador', 'encargado_curso'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Pre-inscripciones', href: '/app/pre-registros', icon: ClipboardIcon, roles: ['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Solicitudes de Inscripción', href: '/app/enrollment-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
	]
};

const staffAdminGroup: NavigationGroup = {
	type: 'group',
	name: 'Administrativo',
	icon: UsersIcon,
	roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'coordinador'],
	loginTypes: ['admin'],
	children: [
		// US-003 (2026-08-03): Comunicados. Anuncios oficiales a estudiantes
		// con pop-up al primer login. Crear/editar/eliminar: solo superadmin,
		// encargado de curso y cobranzas. (Kevin 2026-08-03)
		{ type: 'item', name: 'Comunicados', href: '/app/comunicados', icon: BellIcon, roles: ['superadmin', 'encargado_curso', 'cobranza'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Extracto Bancario', href: '/app/bank-statements', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] },
		// F-CORREOS-REGISTRO (2026-08-17, Kevin): "ver cuales son las que llegan
		// a los usuarios". Solo admin/superadmin porque el registro guarda el
		// cuerpo de los correos, y el de credenciales trae la contraseña inicial
		// del alumno en texto plano.
		{ type: 'item', name: 'Registro de Correos', href: '/app/correos', icon: MailIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Visor de Errores', href: '/app/admin/errors', icon: ExclamationIcon, roles: ['admin', 'superadmin'], loginTypes: ['admin'] },
	]
};

const staffRequestsGroup: NavigationGroup = {
	type: 'group',
	name: 'Solicitudes',
	icon: ClipboardIcon,
	roles: ['admin', 'superadmin', 'cpd', 'encargado_curso', 'coordinador'],
	loginTypes: ['admin'],
	children: [
		{ type: 'item', name: 'Solicitudes de Cuenta', href: '/app/account-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		// F-CERT-APROBACION (2026-07-30): cola del encargado para aprobar
		// solicitudes de certificados. Filtra por cursos_asignados.
		{ type: 'item', name: 'Solicitudes de Certificados', href: '/app/certificates/requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Solicitudes de Pasivo', href: '/app/passive-requests', icon: ClipboardIcon, roles: ['admin', 'superadmin', 'cpd'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Solicitudes de Trámite', href: '/app/requests', icon: DocumentAddIcon, roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
	]
};

// R35-FASE-3 (2026-08-07, Kevin): grupo "Calidad de Datos" con el reporte
// consolidado de inconsistencias. Solo superadmin. Vista unica para
// auditar problemas de datos en programas en ejecucion.
const staffDataQualityGroup: NavigationGroup = {
	type: 'group',
	name: 'Calidad de Datos',
	icon: ExclamationIcon,
	roles: ['superadmin'],
	loginTypes: ['admin'],
	children: [
		{
			type: 'item',
			name: 'Reporte de Salud',
			href: '/app/data-health',
			icon: ExclamationIcon,
			roles: ['superadmin'],
			loginTypes: ['admin']
		},
	]
};

// F-REPORTE-BUGS (2026-08-17, Kevin): "un nuevo modulo en el sidebar para
// todos los perfiles excepto docentes y estudiantes, solo perfiles adm, que
// puedan reportar bugs o errores".
//
// Va como item suelto y no dentro de "Administrativo" por dos razones: ese
// grupo no incluye a `encargado_curso` (que sí debe poder reportar), y un
// reporte de error se hace en el momento en que se lo ve — enterrarlo dos
// niveles adentro es la mejor forma de que nadie lo use.
const staffBugReportItem: NavigationItem = {
	type: 'item',
	name: 'Reportar un Error',
	href: '/app/bug-reports',
	icon: ExclamationIcon,
	roles: ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'],
	loginTypes: ['admin']
};

const staffDashboardItem: NavigationItem = {
	type: 'item',
	name: 'Dashboard',
	href: '/app/dashboard',
	icon: HomeIcon,
	roles: ['admin', 'superadmin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'],
	loginTypes: ['admin']
};

const studentDashboardItem: NavigationItem = {
	type: 'item',
	name: 'Mi Dashboard',
	href: '/app/dashboard',
	icon: HomeIcon,
	roles: ['student', 'docente'],
	loginTypes: ['academic']
};

/**
 * Lista completa de items del sidebar (orden alfabetico al runtime,
 * excepto el Dashboard que va primero).
 *
 * Estudiantes/docentes ven `sharedAcademicItems` (su seccion propia).
 * Staff ve los 4 grupos (Academico, Financiero, Inscripciones,
 * Administrativo, Solicitudes) + Dashboard primero.
 *
 * F-REFACTOR-SIDEBAR: este array se construye por composicion.
 * El Sidebar.svelte solo se encarga del render + filtrado.
 */
export function getAllNavItems(): NavigationEntry[] {
	return [
		// === Dashboards (van primero, antes del spacer) ===
		studentDashboardItem,
		staffDashboardItem,

		// === Items compartidos (academic) ===
		...sharedAcademicItems,

		// === Item suelto del staff ===
		staffBugReportItem,

		// === Grupos del staff ===
		staffAcademicGroup,
		staffFinancialGroup,
		staffEnrollmentsGroup,
		staffAdminGroup,
		staffRequestsGroup,
		staffDataQualityGroup,
	];
}
