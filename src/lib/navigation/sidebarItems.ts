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
	UserIcon
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
		{ type: 'item', name: 'Deudores', href: '/app/payments/deudores', icon: ExclamationIcon, roles: ['admin', 'superadmin', 'cobranza', 'mae', 'cpd', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Gestión de Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'cpd', 'cobranza', 'mae'], loginTypes: ['admin'] },
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
		{ type: 'item', name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin', 'cobranza', 'cpd'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'encargado_curso', 'coordinador'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Extracto Bancario', href: '/app/bank-statements', icon: FileTextIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Info. Pagos', href: '/app/payment-config', icon: QrCodeIcon, roles: ['admin', 'superadmin', 'cobranza'], loginTypes: ['admin'] },
		{ type: 'item', name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['superadmin'], loginTypes: ['admin'] },
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

		// === Grupos del staff ===
		staffAcademicGroup,
		staffFinancialGroup,
		staffEnrollmentsGroup,
		staffAdminGroup,
		staffRequestsGroup,
	];
}
