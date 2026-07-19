import { useEffect, useState } from "react";
import { listarVencimientos } from "../lib/firestore";
import {
  colorVencimiento,
  formatFecha,
  etiquetaVencimiento,
  urlWhatsapp,
  diasHasta,
} from "../lib/fechas";

function BotonWhatsapp({ numero }) {
  const url = urlWhatsapp(numero);
  if (!url) return null;
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
  const [items, setItems] = useState(null);

  useEffect(() => {
    listarVencimientos().then((lista) => {
      // ≤1 día primero; dentro de cada grupo, por fecha de vencimiento.
      lista.sort((a, b) => {
        const da = diasHasta(a.fechaVencimiento);
        const db = diasHasta(b.fechaVencimiento);
        const urgA = da !== null && da <= 1 ? 0 : 1;
        const urgB = db !== null && db <= 1 ? 0 : 1;
        if (urgA !== urgB) return urgA - urgB;
        return a.fechaVencimiento - b.fechaVencimiento;
      });
      setItems(lista);
    });
  }, []);

  if (items === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <h2>Vencimientos</h2>
      {items.length === 0 && (
        <div className="vacio">No hay ventas activas todavía.</div>
      )}
      {items.map((item) => {
        const etiqueta = etiquetaVencimiento(item.fechaVencimiento);
        return (
          <div
            key={item.id}
            className={`card ${colorVencimiento(item.fechaVencimiento)}`}
          >
            <div className="card-title">
              {item.clienteNombre}{" "}
              {etiqueta && (
                <span className="badge badge-vencido">{etiqueta}</span>
              )}
            </div>
            <div className="card-sub">
              {item.plataforma} · {item.detalle}
            </div>
            <div className="card-sub">
              Vence: {formatFecha(item.fechaVencimiento)}
            </div>
            <div style={{ marginTop: 8 }}>
              <BotonWhatsapp numero={item.clienteWhatsapp} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
