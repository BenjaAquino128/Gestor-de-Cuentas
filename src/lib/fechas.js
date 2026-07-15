// Funciones puras de fechas: no dependen de React ni de Firebase.

export function calcularFechaVencimiento(fechaActivacion, duracionMeses) {
  if (!fechaActivacion || !duracionMeses) return null;
  const fecha = new Date(fechaActivacion);
  fecha.setMonth(fecha.getMonth() + Number(duracionMeses));
  return fecha;
}

export function diasHasta(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha);
  objetivo.setHours(0, 0, 0, 0);
  const diffMs = objetivo.getTime() - hoy.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Clase de color para la fila según cercanía al vencimiento.
export function colorVencimiento(fecha) {
  const dias = diasHasta(fecha);
  if (dias === null) return "";
  if (dias < 0) return "row-rojo";
  if (dias <= 3) return "row-amarillo";
  return "row-verde";
}

export function formatFecha(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Un perfil "Activo" cuya fecha de vencimiento ya pasó se considera vencido,
// aunque en la base todavía diga "Activo" (se corrige al leer, sin escribir).
export function estadoEfectivo(perfil) {
  if (perfil.estado === "Activo" && perfil.fechaVencimiento) {
    const dias = diasHasta(perfil.fechaVencimiento);
    if (dias !== null && dias < 0) return "Vencido";
  }
  return perfil.estado;
}
