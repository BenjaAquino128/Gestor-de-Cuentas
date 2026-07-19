import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  parsearTexto,
  parsearVariasCuentas,
  agruparCuentasPorCorreo,
} from "../lib/parser";
import {
  guardarCuentasSinDuplicar,
  listarPlataformas,
} from "../lib/firestore";
import {
  MODALIDAD_PERFILES,
  MODALIDAD_PRIVADA,
  normalizarNombrePlataforma,
} from "../lib/fechas";
import CampoSecreto from "./CampoSecreto";

// Alta = lo que compraste (stock). El cliente se carga después al marcar vendido.

function formVacio() {
  return {
    plataforma: "",
    modalidad: MODALIDAD_PRIVADA,
    correo: "",
    contrasena: "",
    pin: "",
    numerosPerfiles: "",
    pinsPorPerfil: {},
    mostrarPerfilPin: false,
    duracionMeses: 1,
    notas: "",
  };
}

// Resuelve al nombre EXACTO de tu lista (aunque el mensaje diga otra variante).
function resolverPlataforma(valor, plataformas) {
  const v = (valor || "").trim();
  if (!v) return "";
  const match = plataformas.find(
    (p) =>
      normalizarNombrePlataforma(p.nombre) ===
      normalizarNombrePlataforma(v)
  );
  return match ? match.nombre : v;
}

// Select con las plataformas cargadas (más fiable que datalist en celu).
function SelectPlataforma({ value, onChange, plataformas, required }) {
  const valueSelect = resolverPlataforma(value, plataformas);
  const enLista = plataformas.some(
    (p) =>
      normalizarNombrePlataforma(p.nombre) ===
      normalizarNombrePlataforma(valueSelect)
  );
  return (
    <select value={valueSelect || ""} onChange={onChange} required={required}>
      <option value="">Elegí plataforma</option>
      {!enLista && valueSelect ? (
        <option value={valueSelect}>{valueSelect}</option>
      ) : null}
      {plataformas.map((p) => (
        <option key={p.id} value={p.nombre}>
          {p.nombre}
        </option>
      ))}
    </select>
  );
}

function describirCuenta(cuenta) {
  const plat = cuenta.plataforma || "Sin plataforma";
  const correo = cuenta.correo || "sin correo";
  return `${plat} · ${correo}`;
}

function prepararParaGuardar(cuenta) {
  const pinsPorPerfil = { ...(cuenta.pinsPorPerfil || {}) };
  const nums = (cuenta.numerosPerfiles || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const conPerfilPin = cuenta.mostrarPerfilPin || nums.length > 0 || !!cuenta.pin;

  if (cuenta.pin && nums.length === 1 && !pinsPorPerfil[nums[0]]) {
    pinsPorPerfil[nums[0]] = cuenta.pin;
  }

  return {
    ...cuenta,
    modalidad: conPerfilPin ? MODALIDAD_PERFILES : MODALIDAD_PRIVADA,
    pinsPorPerfil,
    cantidadPerfiles: nums.length || 1,
  };
}

export default function AgregarCuenta() {
  const navigate = useNavigate();
  const [modo, setModo] = useState("una");
  const [textoProveedor, setTextoProveedor] = useState("");
  const [form, setForm] = useState(formVacio());
  const [lote, setLote] = useState([]);
  const [loteKey, setLoteKey] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [plataformas, setPlataformas] = useState([]);

  useEffect(() => {
    listarPlataformas().then(setPlataformas).catch(() => setPlataformas([]));
  }, []);

  async function analizarTexto() {
    const lista = await listarPlataformas().catch(() => plataformas);
    setPlataformas(lista);
    const nombres = lista.map((p) => p.nombre);
    const detectado = parsearTexto(textoProveedor, nombres);
    const mostrarPerfilPin = !!(detectado.numerosPerfiles || detectado.pin);
    setForm((prev) => ({
      ...prev,
      plataforma: resolverPlataforma(detectado.plataforma, lista),
      correo: detectado.correo,
      contrasena: detectado.contrasena,
      pin: detectado.pin,
      numerosPerfiles: detectado.numerosPerfiles,
      pinsPorPerfil: detectado.pinsPorPerfil || {},
      mostrarPerfilPin,
      modalidad: mostrarPerfilPin ? MODALIDAD_PERFILES : MODALIDAD_PRIVADA,
    }));
  }

  async function analizarVarias() {
    setResultado(null);
    const lista = await listarPlataformas().catch(() => plataformas);
    setPlataformas(lista);
    const nombres = lista.map((p) => p.nombre);
    const detectadas = parsearVariasCuentas(textoProveedor, nombres);
    const agrupadas = agruparCuentasPorCorreo(detectadas);
    setLote(
      agrupadas.map((d) => {
        const mostrarPerfilPin = !!(d.numerosPerfiles || d.pin);
        return {
          ...formVacio(),
          ...d,
          plataforma: resolverPlataforma(d.plataforma, lista),
          mostrarPerfilPin,
          modalidad: mostrarPerfilPin ? MODALIDAD_PERFILES : MODALIDAD_PRIVADA,
        };
      })
    );
    setLoteKey((k) => k + 1);
  }

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarLote(index, campo, valor) {
    setLote((prev) =>
      prev.map((fila, i) => (i === index ? { ...fila, [campo]: valor } : fila))
    );
  }

  // Misma plataforma + correo pero contraseña distinta: decide el usuario.
  function resolverConflictoPass(existente, nueva) {
    const ok = window.confirm(
      `Ya tenés cargada esta cuenta con OTRA contraseña:\n\n` +
        `${describirCuenta(nueva)}\n\n` +
        `Aceptar = actualizar la contraseña de esa cuenta.\n` +
        `Cancelar = no cargar este registro.`
    );
    return ok ? "actualizar" : "rechazar";
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setError("");
    if (!form.plataforma.trim()) {
      setError("La plataforma es obligatoria.");
      return;
    }
    setGuardando(true);
    try {
      const resumen = await guardarCuentasSinDuplicar(
        [prepararParaGuardar(form)],
        resolverConflictoPass
      );
      if (resumen.creadas.length > 0) {
        navigate(`/cuentas/${resumen.creadas[0].id}`);
      } else if (resumen.actualizadas.length > 0) {
        navigate(`/cuentas/${resumen.actualizadas[0].id}`);
      } else if (resumen.mergeadas.length > 0) {
        navigate(`/cuentas/${resumen.mergeadas[0].id}`);
      } else {
        const omitida = resumen.omitidas[0];
        setError(
          omitida?.motivo === "perfiles-existen"
            ? "Esos perfiles ya estaban cargados en la cuenta."
            : omitida?.motivo === "pass-distinta"
              ? "No se cargó: ya existe esa cuenta con otra contraseña."
              : "Esta cuenta ya está cargada (misma plataforma y correo)."
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  async function handleGuardarTodas() {
    setError("");
    for (const fila of lote) {
      if (!fila.plataforma.trim()) {
        setError("Todas las filas necesitan plataforma.");
        return;
      }
    }
    setGuardando(true);
    try {
      const resumen = await guardarCuentasSinDuplicar(
        lote.map(prepararParaGuardar),
        resolverConflictoPass
      );
      setResultado(resumen);
      setLote([]);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="page">
      <button className="btn btn-secondary btn-small" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <h2>Agregar cuenta</h2>
      <p className="card-sub">
        Acá cargás lo que compraste (stock). El cliente lo marcás después, cuando
        vendas, desde el detalle de la cuenta.
      </p>

      <div className="filtros" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn-small ${modo === "una" ? "" : "btn-secondary"}`}
          onClick={() => setModo("una")}
        >
          Una cuenta
        </button>
        <button
          type="button"
          className={`btn btn-small ${modo === "varias" ? "" : "btn-secondary"}`}
          onClick={() => setModo("varias")}
        >
          Importar varias
        </button>
      </div>

      <div className="field">
        <label>Pegá el mensaje del proveedor (opcional)</label>
        <textarea
          value={textoProveedor}
          onChange={(e) => setTextoProveedor(e.target.value)}
          placeholder={"Correo:\nuser@mail.com\n\nContraseña:\npass"}
        />
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={modo === "una" ? analizarTexto : analizarVarias}
        disabled={!textoProveedor}
      >
        {modo === "una" ? "Analizar texto" : "Analizar y previsualizar"}
      </button>

      {resultado && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">Resultado de la importación</div>
          <div className="card-sub" style={{ marginTop: 6 }}>
            {resultado.creadas.length} cargada
            {resultado.creadas.length === 1 ? "" : "s"} ·{" "}
            {resultado.mergeadas.length} con perfiles sumados ·{" "}
            {resultado.actualizadas.length} con contraseña actualizada ·{" "}
            {resultado.omitidas.length} omitida
            {resultado.omitidas.length === 1 ? "" : "s"}
          </div>

          {resultado.actualizadas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="card-sub" style={{ fontWeight: 600 }}>
                Contraseña actualizada:
              </div>
              {resultado.actualizadas.map((a, i) => (
                <div key={i} className="card-sub">
                  {describirCuenta(a.cuenta)}
                </div>
              ))}
            </div>
          )}

          {resultado.mergeadas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="card-sub" style={{ fontWeight: 600 }}>
                Perfiles sumados a cuentas existentes:
              </div>
              {resultado.mergeadas.map((m, i) => (
                <div key={i} className="card-sub">
                  {describirCuenta(m.cuenta)} → perfil
                  {m.perfiles.length === 1 ? "" : "es"} {m.perfiles.join(", ")}
                </div>
              ))}
            </div>
          )}

          {resultado.omitidas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="card-sub" style={{ fontWeight: 600 }}>
                Ya existían (no se cargaron):
              </div>
              {resultado.omitidas.map((o, i) => (
                <div key={i} className="card-sub">
                  {describirCuenta(o.cuenta)}
                  {o.motivo === "perfiles-existen"
                    ? " (perfiles ya cargados)"
                    : o.motivo === "pass-distinta"
                      ? " (otra contraseña, no actualizada)"
                      : ""}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/")}
            >
              Ir a cuentas
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setResultado(null);
                setTextoProveedor("");
              }}
            >
              Cargar más
            </button>
          </div>
        </div>
      )}

      {modo === "varias" && lote.length > 0 && (
        <div key={loteKey} style={{ marginTop: 20 }}>
          <h3>
            Previsualización ({lote.length} cuenta
            {lote.length === 1 ? "" : "s"})
          </h3>
          {lote.map((fila, index) => (
            <div key={`${loteKey}-${index}`} className="card">
              <div className="card-sub" style={{ marginBottom: 8 }}>
                Cuenta {index + 1}
              </div>
              <div className="field">
                <label>Plataforma</label>
                <SelectPlataforma
                  value={fila.plataforma}
                  onChange={(e) =>
                    actualizarLote(index, "plataforma", e.target.value)
                  }
                  plataformas={plataformas}
                />
              </div>
              <div className="field">
                <label>Correo</label>
                <input
                  value={fila.correo}
                  onChange={(e) =>
                    actualizarLote(index, "correo", e.target.value)
                  }
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  value={fila.contrasena}
                  onChange={(e) =>
                    actualizarLote(index, "contrasena", e.target.value)
                  }
                />
              </div>
              {fila.mostrarPerfilPin && (
                <>
                  <div className="field">
                    <label>Perfil (número)</label>
                    <input
                      value={fila.numerosPerfiles}
                      onChange={(e) =>
                        actualizarLote(index, "numerosPerfiles", e.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label>PIN</label>
                    <input
                      value={fila.pin || ""}
                      onChange={(e) =>
                        actualizarLote(index, "pin", e.target.value)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          ))}
          {error && <p className="error-msg">{error}</p>}
          <button
            className="btn btn-block"
            type="button"
            onClick={handleGuardarTodas}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : `Guardar todas (${lote.length})`}
          </button>
        </div>
      )}

      {modo === "una" && (
        <form onSubmit={handleGuardar} style={{ marginTop: 20 }}>
          <div className="field">
            <label>Plataforma</label>
            <SelectPlataforma
              value={form.plataforma}
              onChange={(e) => actualizarCampo("plataforma", e.target.value)}
              plataformas={plataformas}
              required
            />
            {plataformas.length === 0 && (
              <span className="card-sub">
                No hay plataformas cargadas. Andá a Plataformas y agregá las
                que uses.
              </span>
            )}
          </div>

          <div className="field">
            <label>Correo</label>
            <input
              value={form.correo}
              onChange={(e) => actualizarCampo("correo", e.target.value)}
            />
          </div>

          <CampoSecreto
            etiqueta="Contraseña"
            value={form.contrasena}
            onChange={(e) => actualizarCampo("contrasena", e.target.value)}
          />

          {form.mostrarPerfilPin && (
            <>
              <div className="field">
                <label>Perfil (número)</label>
                <input
                  value={form.numerosPerfiles}
                  onChange={(e) =>
                    actualizarCampo("numerosPerfiles", e.target.value)
                  }
                />
              </div>
              <CampoSecreto
                etiqueta="PIN"
                value={form.pin}
                onChange={(e) => actualizarCampo("pin", e.target.value)}
              />
            </>
          )}

          <div className="field">
            <label>Notas (opcional)</label>
            <textarea
              value={form.notas}
              onChange={(e) => actualizarCampo("notas", e.target.value)}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-block" type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar en stock"}
          </button>
        </form>
      )}
    </div>
  );
}
