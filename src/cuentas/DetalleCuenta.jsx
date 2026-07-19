import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  obtenerCuenta,
  listarPerfiles,
  asignarPerfil,
  editarPerfil,
  liberarPerfil,
  actualizarPin,
  actualizarCuenta,
  marcarCuentaPrivadaVendida,
} from "../lib/firestore";
import {
  estadoEfectivo,
  formatFecha,
  esCuentaPrivada,
  urlWhatsapp,
  aInputDate,
  desdeInputDate,
  calcularFechaVencimiento,
} from "../lib/fechas";
import CampoSecreto from "./CampoSecreto";

const BADGE_POR_ESTADO = {
  Libre: "badge-libre",
  Reservado: "badge-reservado",
  Activo: "badge-activo",
  Vencido: "badge-vencido",
};

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
              <button onClick={() => elegir(onAsignar)}>Marcar como vendido</button>
            )}
            {(estado === "Activo" || estado === "Vencido") && (
              <button onClick={() => elegir(onEditar)}>Editar cliente</button>
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

function FormAsignar({ valoresIniciales, duracionDefault = 1, onConfirmar, onCancelar }) {
  const [clienteNombre, setClienteNombre] = useState(
    valoresIniciales?.clienteNombre || ""
  );
  const [clienteWhatsapp, setClienteWhatsapp] = useState(
    valoresIniciales?.clienteWhatsapp || ""
  );
  const [duracionMeses, setDuracionMeses] = useState(
    valoresIniciales?.duracionMeses || duracionDefault || 1
  );
  // Fecha real de la venta (puede ser en el pasado si cargás tarde).
  const [fechaVenta, setFechaVenta] = useState(
    aInputDate(valoresIniciales?.fechaActivacion)
  );
  const [precioVenta, setPrecioVenta] = useState(
    valoresIniciales?.precioVenta ?? ""
  );
  const [error, setError] = useState("");

  const vencimientoPreview = calcularFechaVencimiento(
    desdeInputDate(fechaVenta),
    duracionMeses
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!clienteWhatsapp.trim()) {
      setError("El teléfono es obligatorio.");
      return;
    }
    onConfirmar({
      clienteNombre,
      clienteWhatsapp,
      duracionMeses,
      fechaActivacion: desdeInputDate(fechaVenta),
      precioVenta,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label>Nombre del cliente (opcional)</label>
        <input
          value={clienteNombre}
          onChange={(e) => setClienteNombre(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Teléfono / WhatsApp (obligatorio)</label>
        <input
          value={clienteWhatsapp}
          onChange={(e) => setClienteWhatsapp(e.target.value)}
          placeholder="+595 986 111-222"
          required
        />
      </div>
      <div className="field">
        <label>Fecha de venta</label>
        <input
          type="date"
          value={fechaVenta}
          onChange={(e) => setFechaVenta(e.target.value)}
          required
        />
        <span className="card-sub">
          Si la vendiste antes, poné esa fecha. El vencimiento se calcula desde
          acá.
        </span>
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
      <div className="card-sub">
        Vence el: {formatFecha(vencimientoPreview)}
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
      {error && <p className="error-msg">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" type="submit">
          {valoresIniciales ? "Guardar cambios" : "Marcar como vendido"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormEditarCuenta({ cuenta, onConfirmar, onCancelar }) {
  const [form, setForm] = useState({
    plataforma: cuenta.plataforma || "",
    correo: cuenta.correo || "",
    contrasena: cuenta.contrasena || "",
    notas: cuenta.notas || "",
  });

  function setCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onConfirmar(form);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label>Plataforma</label>
        <input
          value={form.plataforma}
          onChange={(e) => setCampo("plataforma", e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>Correo</label>
        <input
          value={form.correo}
          onChange={(e) => setCampo("correo", e.target.value)}
        />
      </div>
      <CampoSecreto
        etiqueta="Contraseña"
        value={form.contrasena}
        onChange={(e) => setCampo("contrasena", e.target.value)}
      />
      <div className="field">
        <label>Notas</label>
        <textarea
          value={form.notas}
          onChange={(e) => setCampo("notas", e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" type="submit">
          Guardar cambios
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
  // null | { tipo: "perfil", perfilId, modo } | { tipo: "privada", modo }
  const [accion, setAccion] = useState(null);
  const [editandoCuenta, setEditandoCuenta] = useState(false);

  const cargar = useCallback(async () => {
    const c = await obtenerCuenta(cuentaId);
    setCuenta(c);
    if (c && !esCuentaPrivada(c.modalidad)) {
      setPerfiles(await listarPerfiles(cuentaId));
    } else {
      setPerfiles([]);
    }
  }, [cuentaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleConfirmar(datosCliente) {
    if (accion?.tipo === "privada") {
      await marcarCuentaPrivadaVendida(cuentaId, datosCliente);
    } else if (accion.modo === "editar") {
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

  async function handleGuardarCuenta(datos) {
    await actualizarCuenta(cuentaId, datos);
    setEditandoCuenta(false);
    cargar();
  }

  if (!cuenta || perfiles === null) return <div className="page">Cargando...</div>;

  const privada = esCuentaPrivada(cuenta.modalidad);
  const wa = urlWhatsapp(cuenta.clienteWhatsapp);

  return (
    <div className="page">
      <button className="btn btn-secondary btn-small" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: "12px 0" }}>
          {cuenta.plataforma} — {cuenta.modalidad}
        </h2>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setEditandoCuenta((v) => !v)}
        >
          {editandoCuenta ? "Cancelar edición" : "Editar cuenta"}
        </button>
      </div>

      {editandoCuenta && (
        <FormEditarCuenta
          cuenta={cuenta}
          onConfirmar={handleGuardarCuenta}
          onCancelar={() => setEditandoCuenta(false)}
        />
      )}

      {!editandoCuenta && (
        <>
          <Copiable etiqueta="Correo de la cuenta" valor={cuenta.correo} />
          <CampoSecreto
            modo="texto"
            etiqueta="Contraseña de la cuenta"
            value={cuenta.contrasena}
            onCopiar
          />
          {cuenta.notas && (
            <div className="field">
              <label>Notas</label>
              <div className="copiable">{cuenta.notas}</div>
            </div>
          )}

          {privada && (
            <div className="card">
              {cuenta.vendida ? (
                <>
                  <span className="badge badge-activo">Vendida</span>
                  <div className="card-title" style={{ marginTop: 8 }}>
                    {cuenta.clienteNombre || "(sin nombre)"}
                  </div>
                  <div className="card-sub">
                    Tel: {cuenta.clienteWhatsapp || "-"}
                  </div>
                  <div className="card-sub">
                    Venta: {formatFecha(cuenta.fechaActivacion)} ·{" "}
                    {cuenta.duracionMeses || 1} mes(es) · vence{" "}
                    {formatFecha(cuenta.fechaVencimiento)}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    {wa && (
                      <a
                        className="btn btn-whatsapp btn-small"
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() =>
                        setAccion({ tipo: "privada", modo: "editar" })
                      }
                    >
                      Editar venta
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="badge badge-libre">En stock</span>
                  <div className="card-sub" style={{ marginTop: 8 }}>
                    Todavía no vendida. Cuando la vendas, marcá acá y el
                    vencimiento cuenta desde ese día.
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={() =>
                      setAccion({ tipo: "privada", modo: "asignar" })
                    }
                  >
                    Marcar como vendida
                  </button>
                </>
              )}
              {accion?.tipo === "privada" && (
                <div style={{ marginTop: 12 }}>
                  <FormAsignar
                    valoresIniciales={
                      accion.modo === "editar" ? cuenta : null
                    }
                    duracionDefault={1}
                    onConfirmar={handleConfirmar}
                    onCancelar={() => setAccion(null)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!privada && (
        <>
          <h3>Perfiles</h3>
          <div className="card">
            {perfiles.map((perfil) => {
              const estado = estadoEfectivo(perfil);
              const accionEnEsteFila =
                accion?.tipo !== "privada" && accion?.perfilId === perfil.id;
              return (
                <div key={perfil.id}>
                  <div className="perfil-row">
                    <div>
                      <strong>Perfil {perfil.numeroPerfil}</strong>{" "}
                      <span className={`badge ${BADGE_POR_ESTADO[estado]}`}>
                        {estado}
                      </span>
                      <div
                        className="card-sub"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        PIN:{" "}
                        <CampoSecreto
                          compact
                          value={perfil.pin || ""}
                          onChange={(e) =>
                            handleCambiarPin(perfil.id, e.target.value)
                          }
                          placeholder="----"
                        />
                      </div>
                      {(estado === "Activo" || estado === "Vencido") && (
                        <div className="card-sub">
                          {perfil.clienteNombre || "(sin nombre)"} · vence{" "}
                          {formatFecha(perfil.fechaVencimiento)}
                        </div>
                      )}
                    </div>
                    {estado !== "Reservado" && (
                      <MenuPerfil
                        estado={estado}
                        onAsignar={() =>
                          setAccion({
                            tipo: "perfil",
                            perfilId: perfil.id,
                            modo: "asignar",
                          })
                        }
                        onEditar={() =>
                          setAccion({
                            tipo: "perfil",
                            perfilId: perfil.id,
                            modo: "editar",
                          })
                        }
                        onLiberar={() => handleLiberar(perfil.id)}
                      />
                    )}
                  </div>
                  {accionEnEsteFila && (
                    <FormAsignar
                      valoresIniciales={accion.modo === "editar" ? perfil : null}
                      duracionDefault={cuenta.duracionMesesDefault || 1}
                      onConfirmar={handleConfirmar}
                      onCancelar={() => setAccion(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
