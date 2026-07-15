import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarCuentas, listarPerfiles } from "../lib/firestore";
import { estadoEfectivo } from "../lib/fechas";

// Card de una cuenta con su resumen de perfiles ocupados/libres.
// Vive acá adentro (no en un archivo propio) porque solo la usa esta pantalla.
function CuentaCard({ cuenta }) {
  const libres = cuenta.perfilesLibres;
  return (
    <Link to={`/cuentas/${cuenta.id}`} className="card" style={{ display: "block" }}>
      <div className="card-title">{cuenta.plataforma}</div>
      <div className="card-sub">{cuenta.modalidad}</div>
      <div className="card-sub">
        {cuenta.cantidadPerfiles - libres} ocupados / {libres} libres de{" "}
        {cuenta.cantidadPerfiles}
      </div>
    </Link>
  );
}

export default function ListaCuentas() {
  const [cuentas, setCuentas] = useState(null);
  const [filtroPlataforma, setFiltroPlataforma] = useState("");
  const [soloConLibres, setSoloConLibres] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const lista = await listarCuentas();
    // Para cada cuenta calculamos cuántos perfiles están libres,
    // considerando "Vencido" (efectivo) como libre para revender también cuenta como ocupado hasta liberarlo a mano.
    const conResumen = await Promise.all(
      lista.map(async (cuenta) => {
        const perfiles = await listarPerfiles(cuenta.id);
        const libres = perfiles.filter(
          (p) => estadoEfectivo(p) === "Libre"
        ).length;
        return { ...cuenta, perfilesLibres: libres };
      })
    );
    setCuentas(conResumen);
  }

  const plataformas = useMemo(() => {
    if (!cuentas) return [];
    return [...new Set(cuentas.map((c) => c.plataforma))].sort();
  }, [cuentas]);

  const cuentasFiltradas = useMemo(() => {
    if (!cuentas) return [];
    return cuentas.filter((c) => {
      if (filtroPlataforma && c.plataforma !== filtroPlataforma) return false;
      if (soloConLibres && c.perfilesLibres <= 0) return false;
      return true;
    });
  }, [cuentas, filtroPlataforma, soloConLibres]);

  const agrupadas = useMemo(() => {
    const grupos = {};
    for (const c of cuentasFiltradas) {
      grupos[c.plataforma] = grupos[c.plataforma] || [];
      grupos[c.plataforma].push(c);
    }
    return grupos;
  }, [cuentasFiltradas]);

  if (cuentas === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <div className="filtros">
        <select
          value={filtroPlataforma}
          onChange={(e) => setFiltroPlataforma(e.target.value)}
        >
          <option value="">Todas las plataformas</option>
          {plataformas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={soloConLibres}
            onChange={(e) => setSoloConLibres(e.target.checked)}
          />
          Con perfiles libres
        </label>
      </div>

      {Object.keys(agrupadas).length === 0 && (
        <div className="vacio">No hay cuentas que coincidan con el filtro.</div>
      )}

      {Object.entries(agrupadas).map(([plataforma, lista]) => (
        <div key={plataforma}>
          <div className="grupo-titulo">{plataforma}</div>
          {lista.map((cuenta) => (
            <CuentaCard key={cuenta.id} cuenta={cuenta} />
          ))}
        </div>
      ))}

      <Link to="/nueva" className="fab" aria-label="Agregar cuenta">
        +
      </Link>
    </div>
  );
}
