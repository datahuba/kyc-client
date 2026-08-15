/**
 * Servicio de Comunicados
 * =======================
 *
 * US-003 (2026-08-03): Módulo "Comunicados" en sidebar admin.
 * Anuncios oficiales del personal (superadmin, encargado, cobranzas)
 * hacia los estudiantes. Pop-up al primer login del estudiante.
 *
 * Endpoints:
 * - GET    /comunicados                       (admin: listar)
 * - POST   /comunicados                       (admin: crear)
 * - GET    /comunicados/{id}                  (admin o estudiante)
 * - PATCH  /comunicados/{id}                  (admin: autor o superadmin)
 * - DELETE /comunicados/{id}                  (admin: autor o superadmin)
 * - GET    /comunicados/pending/me            (estudiante: mis no vistos)
 * - POST   /comunicados/{id}/mark-as-seen     (estudiante: marcar visto)
 */

import { apiKyC } from '$lib/config';

export interface Adjunto {
	url: string;
	nombre: string;
	tipo: 'image' | 'pdf';
	public_id: string;
}

export interface ComunicadoListItem {
	id: string;
	titulo: string;
	autor_nombre: string;
	autor_rol: string;
	importancia: 'normal' | 'urgente';
	cursos_count: number;
	total_vistos: number;
	email_enviado: boolean;
	created_at: string;
}

export interface ComunicadoResponse {
	id: string;
	titulo: string;
	contenido: string;
	autor_id: string;
	autor_nombre: string;
	autor_rol: string;
	cursos_ids: string[];
	importancia: 'normal' | 'urgente';
	adjuntos: Adjunto[];
	expira_en: string | null;
	enviar_email: boolean;
	email_enviado: boolean;
	email_enviado_en: string | null;
	email_destinatarios: number;
	total_vistos: number;
	created_at: string;
	updated_at: string;
}

export interface ComunicadoEstudiante {
	id: string;
	titulo: string;
	contenido: string;
	autor_nombre: string;
	autor_rol: string;
	importancia: 'normal' | 'urgente';
	adjuntos: Adjunto[];
	expira_en: string | null;
	created_at: string;
	visto: boolean;
}

export interface ComunicadosPendientes {
	cantidad: number;
	comunicados: ComunicadoEstudiante[];
}

export interface ComunicadosListResponse {
	items: ComunicadoListItem[];
	total: number;
}

export interface ComunicadoCreateInput {
	titulo: string;
	contenido: string;
	cursos_ids?: string[];
	importancia?: 'normal' | 'urgente';
	adjuntos?: Adjunto[];
	expira_en?: string | null;
	enviar_email?: boolean;
}

export interface ComunicadoUpdateInput {
	titulo?: string;
	contenido?: string;
	cursos_ids?: string[];
	importancia?: 'normal' | 'urgente';
	adjuntos?: Adjunto[];
	expira_en?: string | null;
}

export const comunicadosService = {
	// === Panel admin ===

	async listar(skip = 0, limit = 20, soloMios = false): Promise<ComunicadosListResponse> {
		const params = new URLSearchParams();
		if (skip) params.set('skip', String(skip));
		if (limit) params.set('limit', String(limit));
		if (soloMios) params.set('solo_mios', 'true');
		const qs = params.toString();
		return await apiKyC.get<ComunicadosListResponse>(`/comunicados${qs ? '?' + qs : ''}`);
	},

	async crear(data: ComunicadoCreateInput): Promise<ComunicadoResponse> {
		// F-FIX-TIMEOUT-60S-COMUNICADO (2026-08-09, Kevin): POST /comunicados
		// puede enviar emails a N estudiantes inscritos en el programa. Con
		// 64 inscritos y SMTP lento, esto puede tardar >30s. customTimeout 60s.
		return await apiKyC.post<ComunicadoResponse>('/comunicados', data, { customTimeout: 60000 });
	},

	async obtener(id: string): Promise<ComunicadoResponse> {
		return await apiKyC.get<ComunicadoResponse>(`/comunicados/${id}`);
	},

	async editar(id: string, data: ComunicadoUpdateInput): Promise<ComunicadoResponse> {
		return await apiKyC.patch<ComunicadoResponse>(`/comunicados/${id}`, data);
	},

	async eliminar(id: string): Promise<void> {
		await apiKyC.delete(`/comunicados/${id}`);
	},

	// === Estudiante ===

	async pendientes(): Promise<ComunicadosPendientes> {
		return await apiKyC.get<ComunicadosPendientes>('/comunicados/pending/me');
	},

	async marcarVisto(id: string): Promise<{ ok: boolean; comunicado_id: string; visto_en: string }> {
		return await apiKyC.post(`/comunicados/${id}/mark-as-seen`, undefined);
	},
};
