import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listarCuentas, listarPerfiles } from "../lib/firestore";
import {
  esCuentaPrivada,
  estadoEfectivo,
  formatFecha,
  mismaPlataforma,
} from "../lib/fechas";

// Cuentas agrupadas bajo un nombre de plataforma.
export default function DetallePlataforma() {
  const { nombre: nombreEncoded } = useParams();
  const nombre = decodeURIComponent(nombreEncoded || "");
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState(null);

  useEffect(() => {
    cargar();
  }, [nombre]);

  async function cargar() {
    const todas = await listarCuentas();
    const deEsta = todas.filter((c) => mismaPlataforma(c.plataforma, nombre));

    const conResumen = await Promise.all(
      deEsta.map(async (cuenta) => {
        if (esCuentaPrivada(cuenta.modalidad)) {
          return { ...cuenta, resumen: null };
        }
        const perfiles = await listarPerfiles(cuenta.id);
        const libres = perfiles.filter((p) => estadoEfectivo(p) === "Libre").length;
        const activos = perfiles.filter((p) => estadoEfectivo(p) === "Activo").length;
        return {
          ...cuenta,
          resumen: { libres, activos, total: perfiles.length },
        };
      })
    );

    setCuentas(conResumen);
  }

  if (cuentas === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <button
        className="btn btn-secondary btn-small"
        onClick={() => navigate("/plataformas")}
      >
        ← Plataformas
      </button>
      <h2>{nombre}</h2>
      <p className="card-sub">
        {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"}
      </p>

      {cuentas.length === 0 ? (
        <div className="vacio">No hay cuentas cargadas de {nombre}.</div>
      ) : (
        cuentas.map((cuenta) => (
          <Link
            key={cuenta.id}
            to={`/cuentas/${cuenta.id}`}
            className="card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div className="card-title">{cuenta.correo || "(sin correo)"}</div>
            <div className="card-sub">{cuenta.modalidad}</div>
            {esCuentaPrivada(cuenta.modalidad) ? (
              <div className="card-sub">
                {cuenta.vendida
                  ? `${cuenta.clienteNombre || "(sin nombre)"} · vence ${formatFecha(cuenta.fechaVencimiento)}`
                  : "En stock (sin vender)"}
              </div>
            ) : (
              <div className="card-sub">
                {cuenta.resumen
                  ? `${cuenta.resumen.activos} activos · ${cuenta.resumen.libres} libres · ${cuenta.resumen.total} perfiles`
                  : `${cuenta.cantidadPerfiles} perfiles`}
              </div>
            )}
            {cuenta.notas && (
              <div className="card-sub">Notas: {cuenta.notas}</div>
            )}
          </Link>
        ))
      )}
    </div>
  );
}
