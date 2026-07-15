// Toda la lectura/escritura a Firestore vive acá. Ninguna pantalla
// habla directo con la base: así es fácil auditar qué se guarda y
// evitar que se logueen datos sensibles (correo/contraseña) por accidente.

import {
  addDoc,
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { calcularFechaVencimiento } from "./fechas";

const cuentasRef = collection(db, "cuentas");

function toDate(valor) {
  if (!valor) return null;
  return valor instanceof Timestamp ? valor.toDate() : valor;
}

function mapCuenta(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    fechaCompra: toDate(data.fechaCompra),
  };
}

function mapPerfil(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    cuentaId: docSnap.ref.parent.parent.id,
    ...data,
    fechaActivacion: toDate(data.fechaActivacion),
    fechaVencimiento: toDate(data.fechaVencimiento),
  };
}

// ---------- Cuentas ----------

export async function listarCuentas() {
  const snap = await getDocs(cuentasRef);
  return snap.docs.map(mapCuenta);
}

export async function obtenerCuenta(cuentaId) {
  const snap = await getDoc(doc(db, "cuentas", cuentaId));
  return snap.exists() ? mapCuenta(snap) : null;
}

// Convierte "4,5" (texto) en [4, 5] (números). Si viene vacío, devuelve null
// para indicar "usar numeración automática 1..N".
function parseNumerosPerfiles(texto) {
  if (!texto) return null;
  const numeros = texto
    .split(",")
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !isNaN(n));
  return numeros.length > 0 ? numeros : null;
}

// Crea la cuenta y, en el mismo batch, los perfiles vacíos en estado "Libre".
// Si `cuenta.numerosPerfiles` viene cargado (ej: "4,5"), los perfiles se crean
// con esos números reales (los que te asignó el proveedor) en vez de 1..N —
// útil cuando solo gestionás algunos perfiles puntuales de una cuenta compartida.
export async function crearCuenta(cuenta) {
  const numerosEspecificos = parseNumerosPerfiles(cuenta.numerosPerfiles);
  const cantidad = numerosEspecificos
    ? numerosEspecificos.length
    : Number(cuenta.cantidadPerfiles) || 1;

  const cuentaDoc = await addDoc(cuentasRef, {
    plataforma: cuenta.plataforma,
    modalidad: cuenta.modalidad,
    correo: cuenta.correo || "",
    contrasena: cuenta.contrasena || "",
    cantidadPerfiles: cantidad,
    fechaCompra: Timestamp.now(),
    notas: cuenta.notas || "",
  });

  const batch = writeBatch(db);
  const perfilesRef = collection(db, "cuentas", cuentaDoc.id, "perfiles");

  for (let i = 0; i < cantidad; i++) {
    const numeroPerfil = numerosEspecificos ? numerosEspecificos[i] : i + 1;
    const perfilDoc = doc(perfilesRef);
    batch.set(perfilDoc, {
      numeroPerfil,
      pin: "",
      estado: "Libre",
      plataforma: cuenta.plataforma, // denormalizado para la pantalla de vencimientos
    });
  }
  await batch.commit();

  return cuentaDoc.id;
}

// ---------- Perfiles ----------

export async function listarPerfiles(cuentaId) {
  const snap = await getDocs(collection(db, "cuentas", cuentaId, "perfiles"));
  return snap.docs
    .map(mapPerfil)
    .sort((a, b) => a.numeroPerfil - b.numeroPerfil);
}

export async function actualizarPin(cuentaId, perfilId, pin) {
  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), { pin });
}

export async function marcarReservado(cuentaId, perfilId) {
  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    estado: "Reservado",
  });
}

// Asigna un perfil libre (o reasigna uno liberado) a un cliente.
export async function asignarPerfil(cuentaId, perfilId, datosCliente) {
  const fechaActivacion = new Date();
  const fechaVencimiento = calcularFechaVencimiento(
    fechaActivacion,
    datosCliente.duracionMeses
  );

  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    estado: "Activo",
    clienteNombre: datosCliente.clienteNombre || "",
    clienteWhatsapp: datosCliente.clienteWhatsapp || "",
    fechaActivacion: Timestamp.fromDate(fechaActivacion),
    duracionMeses: Number(datosCliente.duracionMeses) || 0,
    fechaVencimiento: fechaVencimiento
      ? Timestamp.fromDate(fechaVencimiento)
      : null,
    precioVenta:
      datosCliente.precioVenta !== undefined && datosCliente.precioVenta !== ""
        ? Number(datosCliente.precioVenta)
        : null,
  });
}

// Edita los datos de un cliente ya asignado (perfil "Activo" o "Vencido"),
// sin reiniciar la fecha de activación original — solo recalcula el
// vencimiento si cambió la duración.
export async function editarPerfil(cuentaId, perfilId, perfilActual, datosCliente) {
  const fechaActivacion = toDate(perfilActual.fechaActivacion) || new Date();
  const fechaVencimiento = calcularFechaVencimiento(
    fechaActivacion,
    datosCliente.duracionMeses
  );

  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    clienteNombre: datosCliente.clienteNombre || "",
    clienteWhatsapp: datosCliente.clienteWhatsapp || "",
    duracionMeses: Number(datosCliente.duracionMeses) || 0,
    fechaVencimiento: fechaVencimiento
      ? Timestamp.fromDate(fechaVencimiento)
      : null,
    precioVenta:
      datosCliente.precioVenta !== undefined && datosCliente.precioVenta !== ""
        ? Number(datosCliente.precioVenta)
        : null,
  });
}

// Vuelve el perfil a "Libre" y borra los datos del cliente anterior.
export async function liberarPerfil(cuentaId, perfilId) {
  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    estado: "Libre",
    clienteNombre: deleteField(),
    clienteWhatsapp: deleteField(),
    fechaActivacion: deleteField(),
    duracionMeses: deleteField(),
    fechaVencimiento: deleteField(),
    precioVenta: deleteField(),
  });
}

// Trae todos los perfiles de todas las cuentas (collection group query),
// para la pantalla de vencimientos. Alcanza de sobra para el volumen de
// un revendedor individual, sin necesidad de índices compuestos.
export async function listarTodosLosPerfiles() {
  const snap = await getDocs(
    query(collectionGroup(db, "perfiles"), orderBy("numeroPerfil"))
  );
  return snap.docs.map(mapPerfil);
}
