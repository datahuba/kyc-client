import type { Curso } from "./curso.interface";
import type { Pago } from "./pago.interface";
import type { Titulo } from "./titulo.interface";

export interface Estudiante {
  registro: string;         // Usuario de ingreso
  password: string;         // Contraseña (igual al CI la primera vez)

  ci: string;               // Carnet de identidad
  extension: string;        // Departamento (LP, SC, CB...)

  foto: string | null;      // Base64, URL local o archivo cargado

  nombre: string;           // Nombre completo
  celular: string;          // Teléfono
  carrera: string;          // Carrera inscrita
  correo: string;           // Email
  fechaNacimiento: string;  // YYYY-MM-DD
  domicilio: string;        // Dirección

  titulos: Titulo[];        // Lista de títulos
  cursos: Curso[];          // Lista de cursos
  pagos: Pago[];            // Historial de pagos
}