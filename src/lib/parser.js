// Parser por patrones.
// Regla: las COMPARACIONES van en minúsculas (por detrás).
// Lo que se MUESTRA en los campos queda como vino / como lo cargaste vos.

import { normalizarNombrePlataforma } from "./fechas";

const MODALIDAD_PERFILES = "Perfiles compartidos";
const MODALIDAD_PRIVADA = "Cuenta individual privada";

const ETIQUETAS_RESERVADAS = [
  "correo",
  "email",
  "e-mail",
  "usuario",
  "user",
  "contraseña",
  "contrasena",
  "password",
  "pass",
  "clave",
  "pin",
  "perfil",
  "perfiles",
];

// Solo para comparar: nunca se usa para rellenar campos.
function paraComparar(texto) {
  return String(texto || "").toLowerCase().trim();
}

function esEtiquetaReservada(valor) {
  const v = paraComparar(valor);
  return ETIQUETAS_RESERVADAS.some(
    (e) => v === e || v.startsWith(e + " ") || v.startsWith(e + ":")
  );
}

// Quita el prefijo típico de mensajes reenviados/copiados de chat.
// Acepta [hora, fecha] o [fecha, hora], con o sin segundos.
function limpiarTextoWhatsapp(texto) {
  if (!texto) return "";
  return texto
    .replace(
      /^\[\d{1,2}:\d{2}(?::\d{2})?[^\]]*\]\s*[^:\n]+:\s*/gm,
      ""
    )
    .replace(
      /^\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?[^\]]*\]\s*[^:\n]+:\s*/gm,
      ""
    );
}

function valorTrasEtiqueta(texto, etiquetas) {
  const nombres = etiquetas.join("|");
  const re = new RegExp(
    `(?:${nombres})\\s*[:\\-]\\s*(?:\\r?\\n\\s*)?([^\\n]*)`,
    "i"
  );
  const m = texto.match(re);
  if (!m) return "";
  const valor = (m[1] || "").trim(); // se muestra tal cual (sin forzar minúsculas)
  if (!valor || esEtiquetaReservada(valor)) return "";
  return valor;
}

// Primera línea tipo "<Plataforma> 1 dispositivo:" → candidato de nombre.
function candidatoDesdeEncabezado(texto) {
  const primera = texto
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!primera) return "";

  let cand = primera.replace(/:\s*$/, "").trim();
  cand = cand.replace(/\s+\d+\s*dispositivos?\s*$/i, "").trim();
  if (!cand || esEtiquetaReservada(cand)) return "";
  if (cand.length > 40) return "";
  // Evitar líneas que son claramente datos (email, pass suelta, etc.)
  if (cand.includes("@") || /^[0-9,\s]+$/.test(cand)) return "";
  return cand;
}

function matchEnLista(candidato, nombres) {
  const c = normalizarNombrePlataforma(candidato);
  if (!c) return "";
  for (const nombre of nombres) {
    const n = normalizarNombrePlataforma(nombre);
    if (!n) continue;
    if (c === n || c.startsWith(n) || n.startsWith(c) || c.includes(n)) {
      return nombre; // nombre visual de la lista
    }
  }
  return "";
}

// Compara en minúsculas; prioriza el nombre de tu lista; si no, deja el del texto.
function detectarPlataforma(texto, nombresPlataformas = []) {
  const nombres = [...nombresPlataformas]
    .filter(Boolean)
    .sort(
      (a, b) =>
        normalizarNombrePlataforma(b).length -
        normalizarNombrePlataforma(a).length
    );

  if (nombres.length > 0) {
    const textoNorm = normalizarNombrePlataforma(texto);
    for (const nombre of nombres) {
      const n = normalizarNombrePlataforma(nombre);
      if (n && textoNorm.includes(n)) return nombre;
    }
  }

  const encabezado = candidatoDesdeEncabezado(texto);
  if (!encabezado) return "";

  const enLista = matchEnLista(encabezado, nombres);
  return enLista || encabezado;
}

function parsearBloque(texto, nombresPlataformas = []) {
  const resultado = {
    plataforma: "",
    correo: "",
    contrasena: "",
    pin: "",
    numerosPerfiles: "",
    pinsPorPerfil: {},
    modalidad: MODALIDAD_PRIVADA,
  };
  if (!texto) return resultado;

  const limpio = limpiarTextoWhatsapp(texto);

  resultado.plataforma = detectarPlataforma(limpio, nombresPlataformas);
  resultado.correo = valorTrasEtiqueta(limpio, [
    "correo",
    "email",
    "e-mail",
    "usuario",
    "user",
  ]);
  resultado.contrasena = valorTrasEtiqueta(limpio, [
    "contrase(?:ñ|n)a",
    "pass(?:word)?",
    "clave",
  ]);

  const pinMatch = limpio.match(
    /pin\s*[:\-]\s*(?:\r?\n\s*)?([0-9A-Za-z]{1,12})/i
  );
  resultado.pin = pinMatch ? pinMatch[1].trim() : "";
  if (esEtiquetaReservada(resultado.pin)) resultado.pin = "";

  const perfilesMatch = limpio.match(
    /perfil(?:es)?\s*[:\-]\s*(\d+(?:\s*[,y]\s*\d+)*)/i
  );
  if (perfilesMatch) {
    resultado.numerosPerfiles = perfilesMatch[1]
      .split(/[,y]/i)
      .map((n) => n.trim())
      .filter(Boolean)
      .join(",");
  }

  const tienePerfil = !!resultado.numerosPerfiles;
  const tienePin = !!resultado.pin;

  if (tienePerfil || tienePin) {
    resultado.modalidad = MODALIDAD_PERFILES;
    if (tienePerfil && tienePin) {
      const nums = resultado.numerosPerfiles.split(",");
      if (nums.length === 1) {
        resultado.pinsPorPerfil[nums[0]] = resultado.pin;
      }
    }
  } else {
    resultado.modalidad = MODALIDAD_PRIVADA;
    resultado.numerosPerfiles = "";
    resultado.pin = "";
    resultado.pinsPorPerfil = {};
  }

  return resultado;
}

export function parsearTexto(texto, nombresPlataformas = []) {
  return parsearBloque(texto, nombresPlataformas);
}

function esInicioMensajeWhatsapp(linea) {
  return /^\[\d{1,2}:\d{2}/.test(linea.trim());
}

function lineaEmpiezaConPlataforma(linea, nombresPlataformas) {
  const t = normalizarNombrePlataforma(limpiarTextoWhatsapp(linea));
  if (!t) return false;
  return nombresPlataformas.some((n) => {
    const nn = normalizarNombrePlataforma(n);
    return nn && t.startsWith(nn);
  });
}

function esLineaEtiquetaDato(linea) {
  return /^(correo|email|e-mail|usuario|user|contrase(?:ñ|n)a|pass(?:word)?|clave|pin|perfil(?:es)?)\s*[:\-]/i.test(
    linea.trim()
  );
}

// ¿Esta línea parece encabezado de plataforma (no un dato)?
function pareceEncabezadoPlataforma(linea, nombresPlataformas) {
  const t = linea.trim();
  if (!t || esLineaEtiquetaDato(t)) return false;
  if (esInicioMensajeWhatsapp(t)) return true;
  if (lineaEmpiezaConPlataforma(t, nombresPlataformas)) return true;
  const limpio = limpiarTextoWhatsapp(t).trim();
  if (!limpio || esLineaEtiquetaDato(limpio)) return false;
  // "Algo:", "Algo 1 dispositivo:", etc.
  if (/^.+\s+\d+\s*dispositivos?\s*:?\s*$/i.test(limpio)) return true;
  if (/^[^@\n]{2,40}:\s*$/.test(limpio) && !esEtiquetaReservada(limpio)) {
    return true;
  }
  return false;
}

// Al cortar por "Correo:", rescatar el encabezado que quedó en el bloque anterior.
function sacarEncabezadoDelFinal(lineas, nombresPlataformas) {
  const encabezado = [];
  while (lineas.length > 0) {
    const last = lineas[lineas.length - 1];
    const t = last.trim();
    if (!t) {
      encabezado.unshift(lineas.pop());
      continue;
    }
    if (pareceEncabezadoPlataforma(last, nombresPlataformas)) {
      encabezado.unshift(lineas.pop());
      // Si era solo el título, también traer el prefijo WA de arriba si hay.
      continue;
    }
    break;
  }
  return encabezado;
}

function partirEnBloques(texto, nombresPlataformas = []) {
  const porSeparador = texto.split(/\n\s*-{3,}\s*\n/);
  const bloques = [];

  for (const parte of porSeparador) {
    const lineas = parte.split("\n");
    let actual = [];
    let tieneCorreo = false;

    for (const linea of lineas) {
      const t = linea.trim();
      const esCorreoLabel = /^(correo|email|e-mail|usuario|user)\s*[:\-]/i.test(
        t
      );
      const esNuevoMensaje =
        esInicioMensajeWhatsapp(t) ||
        lineaEmpiezaConPlataforma(t, nombresPlataformas);

      if (
        (esNuevoMensaje || esCorreoLabel) &&
        actual.length > 0 &&
        tieneCorreo
      ) {
        let encabezado = [];
        // Corte por "Correo:" (sin marca de mensaje nuevo): el título de
        // plataforma suele estar en la línea de arriba y hay que moverlo.
        if (esCorreoLabel && !esNuevoMensaje) {
          encabezado = sacarEncabezadoDelFinal(actual, nombresPlataformas);
        }
        bloques.push(actual.join("\n").trim());
        actual = [...encabezado, linea];
        tieneCorreo = esCorreoLabel;
      } else {
        actual.push(linea);
        if (esCorreoLabel) tieneCorreo = true;
      }
    }
    if (actual.some((l) => l.trim())) {
      bloques.push(actual.join("\n").trim());
    }
  }

  return bloques.filter(Boolean);
}

export function parsearVariasCuentas(texto, nombresPlataformas = []) {
  if (!texto || !texto.trim()) return [];
  return partirEnBloques(texto, nombresPlataformas).map((b) =>
    parsearBloque(b, nombresPlataformas)
  );
}

// Mismo correo + plataforma → una cuenta.
// Sin correo: NO agrupa (cada bloque vacío de correo queda aparte).
export function agruparCuentasPorCorreo(cuentas) {
  const grupos = new Map();
  let sinCorreo = 0;

  for (const c of cuentas) {
    const correo = (c.correo || "").trim().toLowerCase();
    const plataforma = normalizarNombrePlataforma(c.plataforma);
    // Sin correo real, no mezclar bloques (antes se unían mal si capturaban "Contraseña:")
    const key = correo
      ? `${correo}|${plataforma}`
      : `__sin_correo_${plataforma}_${sinCorreo++}`;

    if (!grupos.has(key)) {
      grupos.set(key, {
        plataforma: c.plataforma || "",
        correo: c.correo || "",
        contrasena: c.contrasena || "",
        pin: "",
        modalidad: c.modalidad || MODALIDAD_PRIVADA,
        pinsPorPerfil: {},
        _nums: new Set(),
      });
    }

    const g = grupos.get(key);
    if (c.plataforma) g.plataforma = c.plataforma;
    if (c.correo) g.correo = c.correo;
    if (c.contrasena) g.contrasena = c.contrasena;

    const nums = (c.numerosPerfiles || "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    for (const n of nums) {
      g._nums.add(n);
      if (c.pinsPorPerfil?.[n]) g.pinsPorPerfil[n] = c.pinsPorPerfil[n];
      else if (c.pin && nums.length === 1) g.pinsPorPerfil[n] = c.pin;
    }

    if (nums.length === 0 && c.pin) {
      g.pin = c.pin;
      g.modalidad = MODALIDAD_PERFILES;
    }
    if (nums.length > 0 || c.modalidad === MODALIDAD_PERFILES) {
      g.modalidad = MODALIDAD_PERFILES;
    }
  }

  return [...grupos.values()].map((g) => {
    const numeros = [...g._nums].sort((a, b) => Number(a) - Number(b));
    const esPerfiles =
      g.modalidad === MODALIDAD_PERFILES || numeros.length > 0 || !!g.pin;
    const pinUnico =
      numeros.length === 1
        ? g.pinsPorPerfil[numeros[0]] || g.pin || ""
        : numeros.length === 0
          ? g.pin || ""
          : "";

    return {
      plataforma: g.plataforma,
      correo: g.correo,
      contrasena: g.contrasena,
      modalidad: esPerfiles ? MODALIDAD_PERFILES : MODALIDAD_PRIVADA,
      numerosPerfiles: numeros.join(","),
      pin: pinUnico,
      pinsPorPerfil: g.pinsPorPerfil,
      cantidadPerfiles: numeros.length || (esPerfiles ? 1 : 0),
    };
  });
}
