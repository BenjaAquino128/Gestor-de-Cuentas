import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  parsearTexto,
  parsearVariasCuentas,
  agruparCuentasPorCorreo,
} from "../lib/parser";
import {
  crearCuenta,
  crearCuentasMasivo,
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

  async function handleGuardar(e) {
    e.preventDefault();
    setError("");
    if (!form.plataforma.trim()) {
      setError("La plataforma es obligatoria.");
      return;
    }
    setGuardando(true);
    try {
      const cuentaId = await crearCuenta(prepararParaGuardar(form));
      navigate(`/cuentas/${cuentaId}`);
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
      await crearCuentasMasivo(lote.map(prepararParaGuardar));
      navigate("/");
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
