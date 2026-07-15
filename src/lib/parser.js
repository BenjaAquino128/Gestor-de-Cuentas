// Parser de texto pegado del proveedor. Nunca lanza error ni bloquea:
// si no encuentra un patrón, devuelve el campo vacío para completar a mano.

const PATRONES = {
  correo: /(?:correo|email|e-mail|usuario|user)\s*[:\-]\s*([^\s\n]+@[^\s\n]+|[^\s\n]{3,})/i,
  contrasena: /(?:contrase(?:ñ|n)a|pass(?:word)?|clave)\s*[:\-]\s*([^\s\n]+)/i,
  pin: /pin\s*[:\-]\s*(\d{2,8})/i,
  // Lista de plataformas conocidas para reconocerlas en cualquier parte del texto,
  // aunque no estén precedidas por "plataforma:" (ej: "Paramount+ 1 dispositivo:").
  // (?![a-zA-Z0-9]) en vez de \b al final, para no "cortar" el + de Disney+/Paramount+/etc.
  plataforma:
    /\b(Netflix|Disney\+?|HBO\s*Max|Max|Paramount\+?|Star\+?|Prime\s*Video|Amazon\s*Prime|Vix|Crunchyroll|Flujo\s*TV|Spotify|Apple\s*TV\+?|YouTube\s*Premium|Plex)(?![a-zA-Z0-9])/i,
  // "Perfil: 4,5" o "Perfiles: 4, 5" -> números específicos asignados por el proveedor.
  perfiles: /perfil(?:es)?\s*[:\-]\s*(\d+(?:\s*[,y]\s*\d+)*)/i,
};

export function parsearTexto(texto) {
  const resultado = {
    plataforma: "",
    correo: "",
    contrasena: "",
    pin: "",
    numerosPerfiles: "",
  };
  if (!texto) return resultado;

  const match = (regex) => {
    const m = texto.match(regex);
    return m ? m[1].trim() : "";
  };

  resultado.plataforma = match(PATRONES.plataforma);
  resultado.correo = match(PATRONES.correo);
  resultado.contrasena = match(PATRONES.contrasena);
  resultado.pin = match(PATRONES.pin);

  const perfilesDetectados = match(PATRONES.perfiles);
  if (perfilesDetectados) {
    // Normaliza "4 y 5" o "4,5" a "4,5".
    resultado.numerosPerfiles = perfilesDetectados
      .split(/[,y]/i)
      .map((n) => n.trim())
      .filter(Boolean)
      .join(",");
  }

  return resultado;
}
