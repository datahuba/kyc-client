/**
 * Servicio de Asistencia (F-2026-08-11-ASISTENCIA)
 * =================================================
 *
 * Sistema de registro de asistencia por sesion/clase para educacion
 * continua UAGRM. Hasta ahora el docente llenaba el % manualmente al
 * cerrar el modulo. Ahora se modelan sesiones y registros individuales.
 *
 * Endpoints backend (prefijo /api/v1/asistencia):
 * - POST   /sesiones                                 - crear sesion
 * - GET    /sesiones?enrollment_id&modulo_index      - listar sesiones
 * - GET    /sesiones/{id}                            - detalle sesion + registros
 * - DELETE /sesiones/{id}                            - eliminar sesion
 * - POST   /sesiones/{id}/registrar                  - bulk registrar asistencia
 * - GET    /enrollment/{id}/modulo/{idx}/porcentaje/{est_id}
 *         - % asistencia calculado
 */

import { apiKyC } from '$lib/config';

export type EstadoAsistencia = 'presente' | 'ausente' | 'tarde' | 'justificado';

export const ESTADOS_ASISTENCIA: EstadoAsistencia[] = [
	'presente',
	'ausente',
	'tarde',
	'justificado'
];

export interface Sesion {
	_id: string;
	enrollment_id: string;
	modulo_index: number;
	fecha: string; // ISO
	tema: string | null;
	creado_por: string;
	created_at: string;
	updated_at: string;
}

export interface SesionDetalle {
	sesion: Sesion;
	registros: AsistenciaRegistro[];
	total_registros: number;
}

export interface AsistenciaRegistro {
	_id: string;
	sesion_id: string;
	estudiante_id: string;
	estado: EstadoAsistencia;
	observacion: string | null;
	registrado_por: string;
	created_at: string;
	updated_at: string;
}

export interface PorcentajeAsistenciaModulo {
	enrollment_id: string;
	modulo_index: number;
	estudiante_id: string;
	total_sesiones: number;
	presentes: number;
	ausentes: number;
	tardes: number;
	justificados: number;
	porcentaje: number;
	cumple_regla_80: boolean;
}

export interface AsistenciaItemInput {
	estudiante_id: string;
	estado: EstadoAsistencia;
	observacion?: string;
}

export const asistenciaService = {
	async crearSesion(input: {
		enrollment_id: string;
		modulo_index: number;
		fecha: string;
		tema?: string;
	}): Promise<Sesion> {
		return await apiKyC.post<Sesion>('/asistencia/sesiones', input);
	},

	async listarSesiones(enrollment_id: string, modulo_index: number): Promise<Sesion[]> {
		return await apiKyC.get<Sesion[]>(
			`/asistencia/sesiones?enrollment_id=${enrollment_id}&modulo_index=${modulo_index}`
		);
	},

	async getSesion(sesion_id: string): Promise<SesionDetalle> {
		return await apiKyC.get<SesionDetalle>(`/asistencia/sesiones/${sesion_id}`);
	},

	async eliminarSesion(sesion_id: string): Promise<void> {
		await apiKyC.delete(`/asistencia/sesiones/${sesion_id}`);
	},

	async registrarAsistenciaBulk(
		sesion_id: string,
		registros: AsistenciaItemInput[]
	): Promise<AsistenciaRegistro[]> {
		return await apiKyC.post<AsistenciaRegistro[]>(
			`/asistencia/sesiones/${sesion_id}/registrar`,
			{ registros }
		);
	},

	async getPorcentajeAsistencia(
		enrollment_id: string,
		modulo_index: number,
		estudiante_id: string
	): Promise<PorcentajeAsistenciaModulo> {
		return await apiKyC.get<PorcentajeAsistenciaModulo>(
			`/asistencia/enrollment/${enrollment_id}/modulo/${modulo_index}/porcentaje/${estudiante_id}`
		);
	}
};
