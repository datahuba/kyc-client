import type { ArchivoRequisito } from "./archivoRequisito.interface";
import type { Estudiante } from "./estudiante.interface";

export interface Curso {
  id: string;                              // Identificador único del curso

  tipo: "curso" | "taller" | "diplomado" | "maestria" | "otro";  
  observacion?: string;                     // Solo si tipo = "otro"

  nombrePrograma: string;                   // Nombre del programa
  modalidad: string;                        // Presencial, virtual, híbrido

  costoTotal: number;                       // Precio total del programa
  cantidadCuotas: number;                   // Número de cuotas
  montoCuota: number;                       // Monto por cuota

  matricula: number;                        // El primer pago debe ser matrícula

  descuentoGeneral?: number;                // Porcentaje de descuento (opcional)

  inscritos: Estudiante[];                  // Lista de estudiantes inscritos

  requisitos: ArchivoRequisito[];           // Lista de archivos subidos como requisito
}
