import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listarPlataformas,
  agregarPlataforma,
  actualizarPlataforma,
  eliminarPlataforma,
  contarCuentasDePlataforma,
  listarCuentas,
} from "../lib/firestore";
import { normalizarNombrePlataforma } from "../lib/fechas";

function MenuPlataforma({ onEditar, onEliminar }) {
  const [abierto, setAbierto] = useState(false);

  function elegir(accion) {
    setAbierto(false);
    accion();
  }

  return (
    <div className="menu-usuario" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        className="btn btn-secondary btn-small"
        aria-label="Opciones"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        ⋮
      </button>
      {abierto && (
        <>
          <div
            className="menu-backdrop"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAbierto(false);
            }}
          />
          <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                elegir(onEditar);
              }}
            >
              Editar plataforma
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                elegir(onEliminar);
              }}
            >
              Eliminar plataforma
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Plataformas() {
  const [filas, setFilas] = useState(null);
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [mostrandoAlta, setMostrandoAlta] = useState(false);
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [nombreEdit, setNombreEdit] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const [config, cuentas] = await Promise.all([
      listarPlataformas(),
      listarCuentas(),
    ]);

    const contador = {};
    for (const c of cuentas) {
      const nombre = (c.plataforma || "").trim();
      if (!nombre) continue;
      const key = normalizarNombrePlataforma(nombre);
      if (!contador[key]) contador[key] = { nombre, cantidad: 0 };
      contador[key].cantidad += 1;
    }

    const porNombre = new Map();
    for (const p of config) {
      const key = normalizarNombrePlataforma(p.nombre);
      porNombre.set(key, {
        id: p.id,
        nombre: p.nombre,
        cantidad: contador[key]?.cantidad || 0,
      });
    }
    for (const [key, data] of Object.entries(contador)) {
      if (!porNombre.has(key)) {
        porNombre.set(key, {
          id: null,
          nombre: data.nombre,
          cantidad: data.cantidad,
        });
      } else {
        const actual = porNombre.get(key);
        actual.cantidad = data.cantidad;
      }
    }

    setFilas(
      [...porNombre.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es")
      )
    );
  }

  async function handleAgregar(e) {
    e.preventDefault();
    setError("");
    if (!nueva.trim()) {
      setError("Escribí un nombre.");
      return;
    }
    await agregarPlataforma(nueva);
    setNueva("");
    setMostrandoAlta(false);
    cargar();
  }

  function empezarEditar(p) {
    setEditando({ id: p.id, nombre: p.nombre });
    setNombreEdit(p.nombre);
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    if (!nombreEdit.trim() || !editando) return;
    await actualizarPlataforma(editando.id, nombreEdit, editando.nombre);
    setEditando(null);
    cargar();
  }

  async function handleEliminar(p) {
    const cantidad = await contarCuentasDePlataforma(p.nombre);
    if (cantidad > 0) {
      window.alert(
        `No podés eliminar "${p.nombre}" porque tiene ${cantidad} cuenta${cantidad === 1 ? "" : "s"} asociada${cantidad === 1 ? "" : "s"}.`
      );
      return;
    }
    const ok = window.confirm(
      `¿Eliminar la plataforma "${p.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    if (p.id) await eliminarPlataforma(p.id);
    cargar();
  }

  if (filas === null) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>Plataformas</h2>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setMostrandoAlta((v) => !v)}
        >
          {mostrandoAlta ? "Cancelar" : "+ Nombre"}
        </button>
      </div>
      <p className="card-sub">
        Tocá una plataforma para ver sus cuentas. El parser usa estos nombres al
        analizar texto.
      </p>

      {mostrandoAlta && (
        <form onSubmit={handleAgregar} className="card">
          <div className="field">
            <label>Nombre de la plataforma</label>
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nombre de la plataforma"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn" type="submit">
            Agregar
          </button>
        </form>
      )}

      {editando && (
        <form onSubmit={handleGuardarEdicion} className="card">
          <div className="field">
            <label>Editar nombre</label>
            <input
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit">
              Guardar
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setEditando(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {filas.length === 0 ? (
        <div className="vacio">
          No hay plataformas todavía. Agregá un nombre o cargá una cuenta.
        </div>
      ) : (
        filas.map((p) => (
          <Link
            key={p.id || p.nombre}
            to={`/plataformas/${encodeURIComponent(p.nombre)}`}
            className="card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div
              className="perfil-row"
              style={{ borderBottom: "none", padding: 0 }}
            >
              <div>
                <div className="card-title">{p.nombre}</div>
                <div className="card-sub">
                  {p.cantidad} cuenta{p.cantidad === 1 ? "" : "s"}
                </div>
              </div>
              <MenuPlataforma
                onEditar={() => empezarEditar(p)}
                onEliminar={() => handleEliminar(p)}
              />
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
