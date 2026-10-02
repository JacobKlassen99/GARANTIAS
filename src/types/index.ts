/**
 * Definición de tipos para Registro de Garantía de Terrenos
 * Asoc. Civil "Colonia Chihuahua"
 *
 * Estructura alineada exactamente con las hojas de Google Sheets:
 * - clientes
 * - lotes
 * - bienes
 * - garantias
 * - garantia_lotes
 * - garantia_bienes
 * - configuracion
 */

export interface Cliente {
  cuenta: string | number;
  nombre: string;
  ci: string;
}

export type EstadoRegistro = 'Disponible' | 'Bloqueado' | 'Inactivo';

export interface Lote {
  idLote: string;
  numeroLote: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaEncargado?: string | number;
  encargado?: string;
  hectareas: number;
  ubicacion: string;
  estado: EstadoRegistro;
  motivoBloqueo?: string;
  fechaBloqueo?: string;
  observacion?: string;
  // Calculado dinámicamente según garantías activas:
  enGarantia?: boolean;
  solicitudGarantiaActiva?: string;
}

export type TipoBien = 'Vehículo' | 'Maquinaria' | 'Implemento' | 'Otro bien';

export interface Bien {
  idBien: string;
  numeroPoliza: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaEncargado?: string | number;
  encargado?: string;
  tipoBien: TipoBien;
  descripcion: string;
  marca: string;
  modelo: string;
  placa: string;
  ubicacion: string;
  estado: EstadoRegistro;
  motivoBloqueo?: string;
  fechaBloqueo?: string;
  observacion?: string;
  // Calculado dinámicamente según garantías activas:
  enGarantia?: boolean;
  solicitudGarantiaActiva?: string;
}

export type TipoGarantiaCon = 'Farmer Rechnung' | 'Campo Grande' | 'Cliente';

export interface GarantiaLoteRelacion {
  idGarantia?: string;
  idLote: string;
  numeroLote: string;
  hectareas: number;
  propietario?: string;
  cuentaPropietario?: string | number;
  ubicacion?: string;
  encargado?: string;
}

export interface GarantiaBienRelacion {
  idGarantia?: string;
  idBien: string;
  numeroPoliza: string;
  tipoBien: string;
  descripcion: string;
  marca: string;
  modelo: string;
  placa?: string;
  propietario?: string;
  cuentaPropietario?: string | number;
  ubicacion?: string;
}

export interface Garantia {
  idGarantia: string;
  numeroSolicitud: string;
  fecha: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaPrestatario: string | number;
  prestatario: string;
  garantiaConTipo: TipoGarantiaCon;
  garantiaConCuenta?: string | number;
  garantiaConNombre: string;
  tipoGarantia: string; // 'Terreno' | 'Bien' | 'Terrenos y Bienes'
  observacion?: string;
  // Relaciones cargadas desde garantia_lotes y garantia_bienes
  lotes: GarantiaLoteRelacion[];
  bienes: GarantiaBienRelacion[];
}

export interface ConfiguracionSistema {
  nombreInstitucion: string;
}

export interface DashboardStats {
  garantiasActivas: number | null;
  hectareasEnGarantia: number | null;
  hectareasDisponibles: number | null;
  bienesEnGarantia: number | null;
  garantiasExternas: number | null;
  lotesBloqueados: number | null;
  bienesBloqueados: number | null;
}

export interface QueryParams {
  page: number;
  pageSize: number; // Por defecto 200
  search?: string;
  filters?: Record<string, any>;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReporteItem {
  id: string;
  titulo: string;
  descripcion: string;
  codigo: string;
}
