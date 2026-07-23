// F-070 (2026-07-22): servicio para Validación de Notas.
// Endpoints para que CPD/Superadmin gestione las notas pendientes de
// validación que cargaron los docentes (ISSUE-Q-NOTA-BORRADOR).

import { apiKyC } from '$lib/config/apiKyC.config';
import type {
    NotasPendientesResponse,
    BulkValidarItem,
    BulkValidarResponse
} from '$lib/interfaces/grade-validation.interface';

export const gradeValidationService = {
    /**
     * Lista las notas pendientes de validación. Permite filtrar por curso,
     * módulo o búsqueda libre por nombre/registro/CI del estudiante.
     */
    async listarNotasPendientes(params?: {
        curso_id?: string;
        modulo_index?: number;
        estudiante_query?: string;
    }): Promise<NotasPendientesResponse> {
        const searchParams = new URLSearchParams();
        if (params?.curso_id) searchParams.append('curso_id', params.curso_id);
        if (params?.modulo_index !== undefined) searchParams.append('modulo_index', String(params.modulo_index));
        if (params?.estudiante_query) searchParams.append('estudiante_query', params.estudiante_query);

        const qs = searchParams.toString();
        return await apiKyC.get<NotasPendientesResponse>(
            `/enrollments/notas-pendientes${qs ? `?${qs}` : ''}`
        );
    },

    /**
     * Aprueba (valida) varias notas pendientes en una sola llamada.
     */
    async bulkValidar(items: BulkValidarItem[]): Promise<BulkValidarResponse> {
        return await apiKyC.post<BulkValidarResponse>(
            '/enrollments/notas/bulk-validar',
            { items }
        );
    },

    /**
     * Edita una nota ya validada. Solo CPD/Superadmin.
     */
    async editarNotaValidada(
        enrollmentId: string,
        moduloIndex: number,
        nota: number,
        motivo?: string
    ): Promise<any> {
        return await apiKyC.put(
            `/enrollments/${enrollmentId}/modulos/${moduloIndex}/nota`,
            { nota, motivo }
        );
    },

    /**
     * Rechaza un borrador de nota individual (usa endpoint existente).
     */
    async rechazarBorrador(enrollmentId: string, moduloIndex: number): Promise<any> {
        return await apiKyC.post(
            `/enrollments/${enrollmentId}/modulos/${moduloIndex}/nota/rechazar`,
            {}
        );
    },
};
