/**
 * Servicio de Solicitudes de Trámite
 * ===================================
 *
 * F-TRAMITES-SOLICITUD (2026-07-29): métodos HTTP para interactuar con
 * /api/tramites/ del backend.
 *
 * Uso típico desde un componente Svelte:
 *   import { tramiteService } from '$lib/services';
 *   const mias = await tramiteService.listarMis();
 *   const nueva = await tramiteService.crear({ tipo: 'tutoria', ... });
 */

import { apiKyC } from '$lib/config/apiKyC.config';
import type {
	EstadoTramite,
	TipoTramite,
	TramiteEstadisticas,
	TramiteSolicitud,
	TramiteSolicitudCreateRequest
} from '$lib/interfaces/tramite-solicitud.interface';

export const tramiteService = {
	/**
	 * El estudiante autenticado crea una solicitud.
	 * Antes de llamar a esto, debe subir los archivos a Cloudinary y tener
	 * las URLs.
	 */
	async crear(data: TramiteSolicitudCreateRequest): Promise<TramiteSolicitud> {
		const r = await apiKyC.post<TramiteSolicitud>('/tramites/', data);
		return r;
	},

	/**
	 * El estudiante ve sus propias solicitudes (ordenadas desc por fecha).
	 */
	async listarMis(): Promise<TramiteSolicitud[]> {
		return await apiKyC.get<TramiteSolicitud[]>('/tramites/my');
	},

	/**
	 * Staff: lista global con paginación y filtros.
	 */
	async listarTodas(opts: {
		page?: number;
		per_page?: number;
		tipo?: TipoTramite;
		estado?: EstadoTramite;
		estudiante_id?: string;
	} = {}): Promise<{ items: TramiteSolicitud[]; total: number; page: number; per_page: number; pages: number }> {
		const params = new URLSearchParams();
		if (opts.page) params.append('page', String(opts.page));
		if (opts.per_page) params.append('per_page', String(opts.per_page));
		if (opts.tipo) params.append('tipo', opts.tipo);
		if (opts.estado) params.append('estado', opts.estado);
		if (opts.estudiante_id) params.append('estudiante_id', opts.estudiante_id);

		const qs = params.toString();
		const url = qs ? `/tramites/?${qs}` : '/tramites/';
		const r = await apiKyC.get<{
			data: TramiteSolicitud[];
			meta: { page: number; limit: number; totalItems: number; totalPages: number };
		}>(url);
		return {
			items: r.data,
			total: r.meta.totalItems,
			page: r.meta.page,
			per_page: r.meta.limit,
			pages: r.meta.totalPages
		};
	},

	/**
	 * Staff: estadísticas para dashboard.
	 */
	async estadisticas(): Promise<TramiteEstadisticas> {
		return await apiKyC.get<TramiteEstadisticas>('/tramites/estadisticas');
	},

	/**
	 * Detalle de una solicitud. Tanto staff como estudiante pueden ver,
	 * pero el backend valida permisos (estudiante solo las suyas).
	 */
	async obtener(id: string): Promise<TramiteSolicitud> {
		return await apiKyC.get<TramiteSolicitud>(`/tramites/${id}`);
	},

	/**
	 * Staff: marcar como en revisión.
	 */
	async marcarEnRevision(id: string): Promise<TramiteSolicitud> {
		return await apiKyC.patch<TramiteSolicitud>(`/tramites/${id}/en-revision`, {});
	},

	/**
	 * Staff: aprobar.
	 */
	async aprobar(id: string, comentario?: string): Promise<TramiteSolicitud> {
		return await apiKyC.patch<TramiteSolicitud>(`/tramites/${id}/aprobar`, {
			comentario: comentario ?? null
		});
	},

	/**
	 * Staff: rechazar (requiere motivo).
	 */
	async rechazar(id: string, motivo: string): Promise<TramiteSolicitud> {
		return await apiKyC.patch<TramiteSolicitud>(`/tramites/${id}/rechazar`, { motivo });
	},

	/**
	 * Estudiante: cancelar su propia solicitud.
	 */
	async cancelar(id: string, motivo?: string): Promise<TramiteSolicitud> {
		return await apiKyC.patch<TramiteSolicitud>(`/tramites/${id}/cancelar`, {
			motivo: motivo ?? null
		});
	}
};
