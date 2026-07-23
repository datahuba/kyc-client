// F-070 (2026-07-22): interfaces para el módulo de Validación de Notas
// Permite a CPD/Superadmin listar y aprobar/rechazar notas pendientes
// de validación que cargaron los docentes.

export interface NotaPendiente {
    enrollment_id: string;
    estudiante_id: string;
    estudiante_nombre: string;
    estudiante_registro?: string;
    estudiante_ci?: string;
    curso_id: string;
    curso_codigo: string;
    curso_nombre?: string;
    modulo_index: number;
    modulo_nombre: string;
    nota_borrador: number;
    docente_username?: string;
    docente_nombre?: string;
    fecha_subida?: string;
    estado: 'pendiente_validacion';
}

export interface NotasPendientesResponse {
    total: number;
    items: NotaPendiente[];
    filtros_aplicados: {
        curso_id?: string;
        modulo_index?: number;
        estudiante_query?: string;
    };
}

export interface BulkValidarItem {
    enrollment_id: string;
    modulo_index: number;
}

export interface BulkValidarResultado {
    enrollment_id: string;
    modulo_index: number;
    ok: boolean;
    error?: string;
    nota_final?: number;
}

export interface BulkValidarResponse {
    total: number;
    exitosos: number;
    fallidos: number;
    resultados: BulkValidarResultado[];
}
