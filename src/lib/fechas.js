// Helpers puros (fechas + teléfono): no dependen de React ni de Firebase.

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

// Para <input type="date"> (YYYY-MM-DD en hora local).
export function aInputDate(fecha) {
  const d = fecha ? new Date(fecha) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function desdeInputDate(valor) {
  if (!valor) return new Date();
  const [y, m, d] = valor.split("-").map(Number);
  // Mediodía local para evitar corrimientos por zona horaria.
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Texto corto para resaltar vencimientos inminentes en la lista.
export function etiquetaVencimiento(fecha) {
  const dias = diasHasta(fecha);
  if (dias === null) return "";
  if (dias < 0) return "Ya vencido";
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return "";
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

// Deja solo dígitos: "+595 986 111-222" -> "595986111222".
export function normalizarTelefono(valor) {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

export function urlWhatsapp(telefono) {
  const digitos = normalizarTelefono(telefono);
  return digitos ? `https://wa.me/${digitos}` : "";
}

export const MODALIDAD_PERFILES = "Perfiles compartidos";
export const MODALIDAD_PRIVADA = "Cuenta individual privada";

export function esCuentaPrivada(modalidad) {
  return (
    modalidad === MODALIDAD_PRIVADA ||
    modalidad === "Cuenta privada" // compatibilidad con datos viejos
  );
}

// Misma plataforma aunque cambien mayúsculas, espacios o símbolos.
export function normalizarNombrePlataforma(nombre) {
  return String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function mismaPlataforma(a, b) {
  const na = normalizarNombrePlataforma(a);
  const nb = normalizarNombrePlataforma(b);
  return !!na && na === nb;
}

// Identidad de una cuenta para detectar duplicados al cargar:
// misma plataforma + mismo correo. La contraseña no entra en la clave;
// si difiere, se resuelve como conflicto (actualizar o rechazar).
export function claveCuenta(cuenta) {
  const plat = normalizarNombrePlataforma(cuenta.plataforma);
  const correo = String(cuenta.correo || "").toLowerCase().trim();
  return `${plat}|${correo}`;
}
