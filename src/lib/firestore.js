// Toda la lectura/escritura a Firestore vive acá. Ninguna pantalla
// habla directo con la base: así es fácil auditar qué se guarda y
// evitar que se logueen datos sensibles (correo/contraseña) por accidente.

import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
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
import {
  calcularFechaVencimiento,
  esCuentaPrivada,
  mismaPlataforma,
  MODALIDAD_PRIVADA,
  normalizarTelefono,
} from "./fechas";

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
    fechaActivacion: toDate(data.fechaActivacion),
    fechaVencimiento: toDate(data.fechaVencimiento),
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

// ---------- Cuentas ----------

export async function listarCuentas() {
  const snap = await getDocs(cuentasRef);
  return snap.docs.map(mapCuenta);
}

export async function obtenerCuenta(cuentaId) {
  const snap = await getDoc(doc(db, "cuentas", cuentaId));
  return snap.exists() ? mapCuenta(snap) : null;
}

// Cuenta individual privada: sin perfiles. Al cargar queda en stock (sin cliente).
// El vencimiento se calcula recién cuando la marques como vendida.
function datosCuentaPrivada(cuenta) {
  return {
    plataforma: cuenta.plataforma,
    modalidad: cuenta.modalidad || MODALIDAD_PRIVADA,
    correo: cuenta.correo || "",
    contrasena: cuenta.contrasena || "",
    cantidadPerfiles: 0,
    fechaCompra: Timestamp.now(),
    notas: cuenta.notas || "",
    vendida: false,
  };
}

// Perfiles compartidos: crea la cuenta + N perfiles en estado "Libre".
function datosCuentaPerfiles(cuenta, numerosEspecificos, cantidad) {
  return {
    plataforma: cuenta.plataforma,
    modalidad: cuenta.modalidad,
    correo: cuenta.correo || "",
    contrasena: cuenta.contrasena || "",
    cantidadPerfiles: cantidad,
    fechaCompra: Timestamp.now(),
    notas: cuenta.notas || "",
    duracionMesesDefault: Number(cuenta.duracionMeses) || 1,
  };
}

export async function crearCuenta(cuenta) {
  if (esCuentaPrivada(cuenta.modalidad)) {
    const cuentaDoc = await addDoc(cuentasRef, datosCuentaPrivada(cuenta));
    return cuentaDoc.id;
  }

  const numerosEspecificos = parseNumerosPerfiles(cuenta.numerosPerfiles);
  const cantidad = numerosEspecificos
    ? numerosEspecificos.length
    : Number(cuenta.cantidadPerfiles) || 1;

  const cuentaDoc = await addDoc(
    cuentasRef,
    datosCuentaPerfiles(cuenta, numerosEspecificos, cantidad)
  );

  const batch = writeBatch(db);
  const perfilesRef = collection(db, "cuentas", cuentaDoc.id, "perfiles");

  const pinsPorPerfil = cuenta.pinsPorPerfil || {};

  for (let i = 0; i < cantidad; i++) {
    const numeroPerfil = numerosEspecificos ? numerosEspecificos[i] : i + 1;
    const pinDePerfil =
      pinsPorPerfil[String(numeroPerfil)] ||
      pinsPorPerfil[numeroPerfil] ||
      (cantidad === 1 && cuenta.pin ? cuenta.pin : "") ||
      "";
    const perfilDoc = doc(perfilesRef);
    batch.set(perfilDoc, {
      numeroPerfil,
      pin: pinDePerfil,
      estado: "Libre",
      plataforma: cuenta.plataforma,
    });
  }
  await batch.commit();

  // Perfiles quedan en "Libre". El cliente se asigna después al marcar vendido.
  return cuentaDoc.id;
}

// Marca / actualiza venta de cuenta privada. El vencimiento corre desde
// fechaActivacion (editable: puede ser una fecha pasada).
export async function marcarCuentaPrivadaVendida(cuentaId, datosCliente) {
  const fechaActivacion = datosCliente.fechaActivacion
    ? new Date(datosCliente.fechaActivacion)
    : new Date();
  const duracionMeses = Number(datosCliente.duracionMeses) || 1;
  const fechaVencimiento = calcularFechaVencimiento(
    fechaActivacion,
    duracionMeses
  );
  const telefono = normalizarTelefono(datosCliente.clienteWhatsapp);

  await updateDoc(doc(db, "cuentas", cuentaId), {
    vendida: true,
    clienteNombre: datosCliente.clienteNombre || "",
    clienteWhatsapp: telefono,
    duracionMeses,
    fechaActivacion: Timestamp.fromDate(fechaActivacion),
    fechaVencimiento: fechaVencimiento
      ? Timestamp.fromDate(fechaVencimiento)
      : null,
    precioVenta:
      datosCliente.precioVenta !== undefined && datosCliente.precioVenta !== ""
        ? Number(datosCliente.precioVenta)
        : null,
  });
}

// ---------- Plataformas (nombres que reconocé el parser) ----------

export async function listarPlataformas() {
  const snap = await getDocs(collection(db, "plataformas"));
  return snap.docs
    .map((d) => ({ id: d.id, nombre: d.data().nombre || "" }))
    .filter((p) => p.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function agregarPlataforma(nombre) {
  const limpio = (nombre || "").trim();
  if (!limpio) return null;
  const docRef = await addDoc(collection(db, "plataformas"), { nombre: limpio });
  return docRef.id;
}

export async function actualizarPlataforma(id, nombreNuevo, nombreAnterior) {
  const limpio = (nombreNuevo || "").trim();
  if (!limpio) return;

  if (id) {
    await updateDoc(doc(db, "plataformas", id), { nombre: limpio });
  }

  // Renombra también las cuentas que tenían el nombre viejo.
  const anterior = (nombreAnterior || "").trim();
  if (!anterior || anterior.toLowerCase() === limpio.toLowerCase()) return;

  const cuentas = await listarCuentas();
  const afectadas = cuentas.filter((c) =>
    mismaPlataforma(c.plataforma, anterior)
  );
  await Promise.all(
    afectadas.map((c) =>
      updateDoc(doc(db, "cuentas", c.id), { plataforma: limpio })
    )
  );
}

export async function contarCuentasDePlataforma(nombre) {
  const cuentas = await listarCuentas();
  return cuentas.filter((c) => mismaPlataforma(c.plataforma, nombre)).length;
}

export async function eliminarPlataforma(id) {
  await deleteDoc(doc(db, "plataformas", id));
}

// Crea varias cuentas en secuencia (cada una con su batch interno de perfiles).
export async function crearCuentasMasivo(cuentas) {
  const ids = [];
  for (const cuenta of cuentas) {
    ids.push(await crearCuenta(cuenta));
  }
  return ids;
}

export async function actualizarCuenta(cuentaId, datos) {
  const cuentaActual = await obtenerCuenta(cuentaId);
  if (!cuentaActual) return;

  const patch = {
    plataforma: datos.plataforma ?? cuentaActual.plataforma,
    modalidad: datos.modalidad ?? cuentaActual.modalidad,
    correo: datos.correo ?? "",
    contrasena: datos.contrasena ?? "",
    notas: datos.notas ?? "",
  };

  // Editar cuenta solo toca datos de acceso/notas.
  // Cliente y vencimiento se manejan al "marcar como vendido".
  if (!esCuentaPrivada(patch.modalidad) && datos.duracionMeses !== undefined) {
    patch.duracionMesesDefault = Number(datos.duracionMeses) || 1;
  }

  await updateDoc(doc(db, "cuentas", cuentaId), patch);
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

export async function asignarPerfil(cuentaId, perfilId, datosCliente) {
  const fechaActivacion = datosCliente.fechaActivacion
    ? new Date(datosCliente.fechaActivacion)
    : new Date();
  const telefono = normalizarTelefono(datosCliente.clienteWhatsapp);
  const fechaVencimiento = calcularFechaVencimiento(
    fechaActivacion,
    datosCliente.duracionMeses
  );

  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    estado: "Activo",
    clienteNombre: datosCliente.clienteNombre || "",
    clienteWhatsapp: telefono,
    fechaActivacion: Timestamp.fromDate(fechaActivacion),
    duracionMeses: Number(datosCliente.duracionMeses) || 1,
    fechaVencimiento: fechaVencimiento
      ? Timestamp.fromDate(fechaVencimiento)
      : null,
    precioVenta:
      datosCliente.precioVenta !== undefined && datosCliente.precioVenta !== ""
        ? Number(datosCliente.precioVenta)
        : null,
  });
}

export async function editarPerfil(cuentaId, perfilId, perfilActual, datosCliente) {
  const fechaActivacion = datosCliente.fechaActivacion
    ? new Date(datosCliente.fechaActivacion)
    : toDate(perfilActual.fechaActivacion) || new Date();
  const telefono = normalizarTelefono(datosCliente.clienteWhatsapp);
  const fechaVencimiento = calcularFechaVencimiento(
    fechaActivacion,
    datosCliente.duracionMeses
  );

  await updateDoc(doc(db, "cuentas", cuentaId, "perfiles", perfilId), {
    clienteNombre: datosCliente.clienteNombre || "",
    clienteWhatsapp: telefono,
    fechaActivacion: Timestamp.fromDate(fechaActivacion),
    duracionMeses: Number(datosCliente.duracionMeses) || 1,
    fechaVencimiento: fechaVencimiento
      ? Timestamp.fromDate(fechaVencimiento)
      : null,
    precioVenta:
      datosCliente.precioVenta !== undefined && datosCliente.precioVenta !== ""
        ? Number(datosCliente.precioVenta)
        : null,
  });
}

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

export async function listarTodosLosPerfiles() {
  const snap = await getDocs(
    query(collectionGroup(db, "perfiles"), orderBy("numeroPerfil"))
  );
  return snap.docs.map(mapPerfil);
}

// Une perfiles activos + cuentas individuales privadas con vencimiento,
// para la pantalla de vencimientos.
export async function listarVencimientos() {
  const [perfiles, cuentas] = await Promise.all([
    listarTodosLosPerfiles(),
    listarCuentas(),
  ]);

  const dePerfiles = perfiles
    .filter((p) => p.estado === "Activo" && p.fechaVencimiento)
    .map((p) => ({
      id: `perfil-${p.id}`,
      tipo: "perfil",
      clienteNombre: p.clienteNombre || "(sin nombre)",
      clienteWhatsapp: p.clienteWhatsapp || "",
      plataforma: p.plataforma,
      detalle: `Perfil ${p.numeroPerfil}`,
      fechaVencimiento: p.fechaVencimiento,
      estado: p.estado,
    }));

  const dePrivadas = cuentas
    .filter(
      (c) =>
        esCuentaPrivada(c.modalidad) &&
        c.vendida &&
        c.fechaVencimiento
    )
    .map((c) => ({
      id: `cuenta-${c.id}`,
      tipo: "cuenta",
      clienteNombre: c.clienteNombre || "(sin nombre)",
      clienteWhatsapp: c.clienteWhatsapp || "",
      plataforma: c.plataforma,
      detalle: "Cuenta individual",
      fechaVencimiento: c.fechaVencimiento,
      estado: "Activo",
    }));

  return [...dePerfiles, ...dePrivadas].sort(
    (a, b) => a.fechaVencimiento - b.fechaVencimiento
  );
}
