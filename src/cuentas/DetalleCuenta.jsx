import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  obtenerCuenta,
  listarPerfiles,
  asignarPerfil,
  editarPerfil,
  liberarPerfil,
  actualizarPin,
} from "../lib/firestore";
import { estadoEfectivo, formatFecha } from "../lib/fechas";

const BADGE_POR_ESTADO = {
  Libre: "badge-libre",
  Reservado: "badge-reservado",
  Activo: "badge-activo",
  Vencido: "badge-vencido",
};

// Fila de texto con botón "Copiar" — vive acá porque solo se usa en esta pantalla.
function Copiable({ etiqueta, valor }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(valor || "");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="field">
      <label>{etiqueta}</label>
      <div className="copiable">
        <span>{valor || "(sin datos)"}</span>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={copiar}
          disabled={!valor}
        >
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

// Menú de tres puntos con las acciones disponibles según el estado del perfil.
function MenuPerfil({ estado, onAsignar, onEditar, onLiberar }) {
  const [abierto, setAbierto] = useState(false);

  function elegir(accion) {
    setAbierto(false);
    accion();
  }

  return (
    <div className="menu-usuario">
      <button
        className="btn btn-secondary btn-small"
        aria-label="Opciones del perfil"
        onClick={() => setAbierto((v) => !v)}
      >
        ⋮
      </button>
      {abierto && (
        <>
          <div className="menu-backdrop" onClick={() => setAbierto(false)} />
          <div className="menu-dropdown">
            {(estado === "Libre" || estado === "Vencido") && (
              <button onClick={() => elegir(onAsignar)}>Asignar cliente</button>
            )}
            {(estado === "Activo" || estado === "Vencido") && (
              <button onClick={() => elegir(onEditar)}>Editar datos</button>
            )}
            {(estado === "Activo" || estado === "Vencido") && (
              <button onClick={() => elegir(onLiberar)}>Liberar perfil</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Formulario para asignar/editar un cliente en un perfil. `valoresIniciales`
// (opcional) precarga los datos cuando se usa en modo edición.
function FormAsignar({ valoresIniciales, onConfirmar, onCancelar }) {
  const [clienteNombre, setClienteNombre] = useState(
    valoresIniciales?.clienteNombre || ""
  );
  const [clienteWhatsapp, setClienteWhatsapp] = useState(
    valoresIniciales?.clienteWhatsapp || ""
  );
  const [duracionMeses, setDuracionMeses] = useState(
    valoresIniciales?.duracionMeses || 1
  );
  const [precioVenta, setPrecioVenta] = useState(
    valoresIniciales?.precioVenta ?? ""
  );

  function handleSubmit(e) {
    e.preventDefault();
    onConfirmar({ clienteNombre, clienteWhatsapp, duracionMeses, precioVenta });
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label>Nombre del cliente</label>
        <input
          value={clienteNombre}
          onChange={(e) => setClienteNombre(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>WhatsApp (solo números, con código de país)</label>
        <input
          value={clienteWhatsapp}
          onChange={(e) => setClienteWhatsapp(e.target.value)}
          placeholder="595986111222"
        />
      </div>
      <div className="field">
        <label>Duración (meses)</label>
        <input
          type="number"
          min={1}
          value={duracionMeses}
          onChange={(e) => setDuracionMeses(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>Precio de venta (opcional, referencia)</label>
        <input
          type="number"
          step="0.01"
          value={precioVenta}
          onChange={(e) => setPrecioVenta(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" type="submit">
          {valoresIniciales ? "Guardar cambios" : "Confirmar"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function DetalleCuenta() {
  const { cuentaId } = useParams();
  const navigate = useNavigate();
  const [cuenta, setCuenta] = useState(null);
  const [perfiles, setPerfiles] = useState(null);
  // { perfilId, modo: "asignar" | "editar" } | null
  const [accion, setAccion] = useState(null);

  useEffect(() => {
    cargar();
  }, [cuentaId]);

  async function cargar() {
    const [c, p] = await Promise.all([
      obtenerCuenta(cuentaId),
      listarPerfiles(cuentaId),
    ]);
    setCuenta(c);
    setPerfiles(p);
  }

  async function handleConfirmar(datosCliente) {
    if (accion.modo === "editar") {
      const perfilActual = perfiles.find((p) => p.id === accion.perfilId);
      await editarPerfil(cuentaId, accion.perfilId, perfilActual, datosCliente);
    } else {
      await asignarPerfil(cuentaId, accion.perfilId, datosCliente);
    }
    setAccion(null);
    cargar();
  }

  async function handleLiberar(perfilId) {
    await liberarPerfil(cuentaId, perfilId);
    cargar();
  }

  async function handleCambiarPin(perfilId, pin) {
    await actualizarPin(cuentaId, perfilId, pin);
    setPerfiles((prev) =>
      prev.map((p) => (p.id === perfilId ? { ...p, pin } : p))
    );
  }

  if (!cuenta || !perfiles) return <div className="page">Cargando...</div>;

  return (
    <div className="page">
      <button className="btn btn-secondary btn-small" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <h2>
        {cuenta.plataforma} — {cuenta.modalidad}
      </h2>

      <Copiable etiqueta="Correo de la cuenta" valor={cuenta.correo} />
      <Copiable etiqueta="Contraseña de la cuenta" valor={cuenta.contrasena} />
      {cuenta.notas && (
        <div className="field">
          <label>Notas</label>
          <div className="copiable">{cuenta.notas}</div>
        </div>
      )}

      <h3>Perfiles</h3>
      <div className="card">
        {perfiles.map((perfil) => {
          const estado = estadoEfectivo(perfil);
          const accionEnEsteFila = accion?.perfilId === perfil.id;
          return (
            <div key={perfil.id}>
              <div className="perfil-row">
                <div>
                  <strong>Perfil {perfil.numeroPerfil}</strong>{" "}
                  <span className={`badge ${BADGE_POR_ESTADO[estado]}`}>
                    {estado}
                  </span>
                  <div className="card-sub">
                    PIN:{" "}
                    <input
                      style={{ width: 70 }}
                      value={perfil.pin || ""}
                      onChange={(e) => handleCambiarPin(perfil.id, e.target.value)}
                      placeholder="----"
                    />
                  </div>
                  {(estado === "Activo" || estado === "Vencido") && (
                    <div className="card-sub">
                      {perfil.clienteNombre} · vence{" "}
                      {formatFecha(perfil.fechaVencimiento)}
                    </div>
                  )}
                </div>
                {estado !== "Reservado" && (
                  <MenuPerfil
                    estado={estado}
                    onAsignar={() =>
                      setAccion({ perfilId: perfil.id, modo: "asignar" })
                    }
                    onEditar={() =>
                      setAccion({ perfilId: perfil.id, modo: "editar" })
                    }
                    onLiberar={() => handleLiberar(perfil.id)}
                  />
                )}
              </div>
              {accionEnEsteFila && (
                <FormAsignar
                  valoresIniciales={accion.modo === "editar" ? perfil : null}
                  onConfirmar={handleConfirmar}
                  onCancelar={() => setAccion(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
