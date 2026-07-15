import { useEffect, useState } from "react";
import { listarTodosLosPerfiles } from "../lib/firestore";
import { colorVencimiento, formatFecha, estadoEfectivo } from "../lib/fechas";

// Botón que abre el chat de WhatsApp del cliente en una pestaña nueva.
// Definido acá adentro porque solo lo usa esta pantalla.
function BotonWhatsapp({ numero }) {
  if (!numero) return null;
  const url = `https://wa.me/${numero}`;
  return (
    <a
      className="btn btn-whatsapp btn-small"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      WhatsApp
    </a>
  );
}

export default function Vencimientos() {
  const [perfiles, setPerfiles] = useState(null);

  useEffect(() => {
    listarTodosLosPerfiles().then((lista) => {
      const conCliente = lista
        .filter((p) => p.estado === "Activo" && p.fechaVencimiento)
        .sort((a, b) => a.fechaVencimiento - b.fechaVencimiento);
      setPerfiles(conCliente);
    });
  }, []);

  if (perfiles === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <h2>Vencimientos</h2>
      {perfiles.length === 0 && (
        <div className="vacio">No hay perfiles activos todavía.</div>
      )}
      {perfiles.map((perfil) => (
        <div key={perfil.id} className={`card ${colorVencimiento(perfil.fechaVencimiento)}`}>
          <div className="card-title">{perfil.clienteNombre}</div>
          <div className="card-sub">
            {perfil.plataforma} · Perfil {perfil.numeroPerfil}
          </div>
          <div className="card-sub">
            Vence: {formatFecha(perfil.fechaVencimiento)}
            {estadoEfectivo(perfil) === "Vencido" && " (ya vencido)"}
          </div>
          <div style={{ marginTop: 8 }}>
            <BotonWhatsapp numero={perfil.clienteWhatsapp} />
          </div>
        </div>
      ))}
    </div>
  );
}
