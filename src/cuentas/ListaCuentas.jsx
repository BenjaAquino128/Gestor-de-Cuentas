import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listarCuentas, listarPerfiles } from "../lib/firestore";
import {
  diasHasta,
  estadoEfectivo,
  esCuentaPrivada,
  formatFecha,
} from "../lib/fechas";

function CuentaCard({ cuenta }) {
  const privada = esCuentaPrivada(cuenta.modalidad);
  const cantidad = cuenta.cantidadPerfiles || 0;
  const ocupados = cantidad - cuenta.perfilesLibres;
  const tipoCuenta = privada
    ? "Cuenta individual privada"
    : `Cuenta completa (${cantidad} ${cantidad === 1 ? "perfil" : "perfiles"})`;
  let estado = { texto: "En stock", clase: "badge-stock" };

  if (privada && cuenta.vendida) {
    estado = { texto: "Alquilada", clase: "badge-completo" };
  } else if (!privada && cuenta.perfilesLibres === 0) {
    estado = { texto: "Alquiler completo", clase: "badge-completo" };
  } else if (!privada && cuenta.perfilesLibres < cantidad) {
    estado = {
      texto: `Parcial · ${ocupados}/${cantidad}`,
      clase: "badge-parcial",
    };
  }

  return (
    <Link to={`/cuentas/${cuenta.id}`} className="card" style={{ display: "block" }}>
      <div className="card-title">{cuenta.correo || "Sin correo"}</div>
      <div className="card-sub">{tipoCuenta}</div>
      <div className="cuenta-badges">
        <span className={`badge ${estado.clase}`}>{estado.texto}</span>
        {cuenta.porVencer && (
          <span className="badge badge-por-vencer">Por vencer</span>
        )}
      </div>
      {privada && cuenta.vendida ? (
        <div className="card-sub">
          {cuenta.clienteNombre || "(sin nombre)"} · vence{" "}
          {formatFecha(cuenta.fechaVencimiento)}
        </div>
      ) : null}
    </Link>
  );
}

function estaPorVencer(fecha) {
  const dias = diasHasta(fecha);
  return dias !== null && dias >= 0 && dias <= 3;
}

export default function ListaCuentas() {
  const [cuentas, setCuentas] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("");
  const [soloConLibres, setSoloConLibres] = useState(false);
  const [vista, setVista] = useState("kanban");
  const [gruposMinimizados, setGruposMinimizados] = useState(() => new Set());

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const lista = await listarCuentas();
    const conResumen = await Promise.all(
      lista.map(async (cuenta) => {
        if (esCuentaPrivada(cuenta.modalidad)) {
          return {
            ...cuenta,
            perfilesLibres: 0,
            textoClientes: `${cuenta.clienteNombre || ""} ${cuenta.clienteWhatsapp || ""}`,
            porVencer:
              cuenta.vendida && estaPorVencer(cuenta.fechaVencimiento),
          };
        }
        const perfiles = await listarPerfiles(cuenta.id);
        const libres = perfiles.filter(
          (p) => estadoEfectivo(p) === "Libre"
        ).length;
        const porVencer = perfiles.some(
          (p) => p.estado === "Activo" && estaPorVencer(p.fechaVencimiento)
        );
        const textoClientes = perfiles
          .map((p) => `${p.clienteNombre || ""} ${p.clienteWhatsapp || ""}`)
          .join(" ");
        return { ...cuenta, perfilesLibres: libres, porVencer, textoClientes };
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
    const termino = busqueda.toLowerCase().trim();
    return cuentas.filter((c) => {
      if (termino) {
        const texto = [
          c.correo,
          c.plataforma,
          c.modalidad,
          c.textoClientes,
        ]
          .join(" ")
          .toLowerCase();
        if (!texto.includes(termino)) return false;
      }
      if (filtroPlataforma && c.plataforma !== filtroPlataforma) return false;
      if (soloConLibres) {
        if (esCuentaPrivada(c.modalidad)) return false;
        if (c.perfilesLibres <= 0) return false;
      }
      return true;
    });
  }, [cuentas, busqueda, filtroPlataforma, soloConLibres]);

  const agrupadas = useMemo(() => {
    const grupos = {};
    for (const c of cuentasFiltradas) {
      grupos[c.plataforma] = grupos[c.plataforma] || [];
      grupos[c.plataforma].push(c);
    }
    return grupos;
  }, [cuentasFiltradas]);

  function alternarGrupo(plataforma) {
    setGruposMinimizados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(plataforma)) siguientes.delete(plataforma);
      else siguientes.add(plataforma);
      return siguientes;
    });
  }

  if (cuentas === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page page-cuentas">
      <div className="filtros">
        <input
          className="buscador-cuentas"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por correo, cliente o plataforma"
          aria-label="Buscar cuentas"
        />
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
        <div className="selector-vista" aria-label="Tipo de vista">
          <button
            type="button"
            className={vista === "kanban" ? "activo" : ""}
            onClick={() => setVista("kanban")}
            aria-pressed={vista === "kanban"}
          >
            Kanban
          </button>
          <button
            type="button"
            className={vista === "lista" ? "activo" : ""}
            onClick={() => setVista("lista")}
            aria-pressed={vista === "lista"}
          >
            Lista
          </button>
        </div>
      </div>

      {Object.keys(agrupadas).length === 0 && (
        <div className="vacio">No hay cuentas que coincidan con el filtro.</div>
      )}

      {vista === "kanban" ? (
        <div className="kanban">
          {Object.entries(agrupadas).map(([plataforma, lista]) => (
            <section className="kanban-columna" key={plataforma}>
              <div className="kanban-titulo">
                <span>{plataforma}</span>
                <span className="kanban-cantidad">{lista.length}</span>
              </div>
              <div className="kanban-tarjetas">
                {lista.map((cuenta) => (
                  <CuentaCard key={cuenta.id} cuenta={cuenta} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        Object.entries(agrupadas).map(([plataforma, lista]) => (
          <div className="grupo-lista" key={plataforma}>
            <button
              type="button"
              className="grupo-lista-cabecera"
              onClick={() => alternarGrupo(plataforma)}
              aria-expanded={!gruposMinimizados.has(plataforma)}
            >
              <span className="grupo-flecha">
                {gruposMinimizados.has(plataforma) ? "▶" : "▼"}
              </span>
              <span>{plataforma}</span>
              <span className="grupo-lista-cantidad">{lista.length}</span>
            </button>
            {!gruposMinimizados.has(plataforma) && (
              <div className="grupo-lista-contenido">
                {lista.map((cuenta) => (
                  <CuentaCard key={cuenta.id} cuenta={cuenta} />
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <Link to="/nueva" className="fab" aria-label="Agregar cuenta">
        +
      </Link>
    </div>
  );
}
