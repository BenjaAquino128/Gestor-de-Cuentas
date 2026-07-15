import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parsearTexto } from "../lib/parser";
import { crearCuenta } from "../lib/firestore";

const MODALIDADES = ["Perfil individual", "Cuenta privada", "Cuenta completa"];

export default function AgregarCuenta() {
  const navigate = useNavigate();
  const [textoProveedor, setTextoProveedor] = useState("");
  const [form, setForm] = useState({
    plataforma: "",
    modalidad: MODALIDADES[0],
    correo: "",
    contrasena: "",
    pin: "",
    cantidadPerfiles: 1,
    numerosPerfiles: "",
    notas: "",
  });
  const [guardando, setGuardando] = useState(false);

  function analizarTexto() {
    const detectado = parsearTexto(textoProveedor);
    setForm((prev) => ({
      ...prev,
      plataforma: detectado.plataforma || prev.plataforma,
      correo: detectado.correo || prev.correo,
      contrasena: detectado.contrasena || prev.contrasena,
      pin: detectado.pin || prev.pin,
      numerosPerfiles: detectado.numerosPerfiles || prev.numerosPerfiles,
      // Si detectamos números específicos (ej: "4,5"), la cantidad de
      // perfiles que gestionás es la cantidad de esos números.
      cantidadPerfiles: detectado.numerosPerfiles
        ? detectado.numerosPerfiles.split(",").length
        : prev.cantidadPerfiles,
    }));
  }

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const cuentaId = await crearCuenta(form);
      navigate(`/cuentas/${cuentaId}`);
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

      <div className="field">
        <label>Pegá el mensaje del proveedor (opcional)</label>
        <textarea
          value={textoProveedor}
          onChange={(e) => setTextoProveedor(e.target.value)}
          placeholder={"Ej: correo: user@mail.com\npass: 123456\npin: 4821"}
        />
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={analizarTexto}
        disabled={!textoProveedor}
      >
        Analizar texto
      </button>

      <form onSubmit={handleGuardar} style={{ marginTop: 20 }}>
        <div className="field">
          <label>Plataforma</label>
          <input
            value={form.plataforma}
            onChange={(e) => actualizarCampo("plataforma", e.target.value)}
            placeholder="Netflix, HBO Max, Flujo TV..."
            required
          />
        </div>

        <div className="field">
          <label>Modalidad</label>
          <select
            value={form.modalidad}
            onChange={(e) => actualizarCampo("modalidad", e.target.value)}
          >
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Correo de la cuenta</label>
          <input
            value={form.correo}
            onChange={(e) => actualizarCampo("correo", e.target.value)}
          />
        </div>

        <div className="field">
          <label>Contraseña de la cuenta</label>
          <input
            value={form.contrasena}
            onChange={(e) => actualizarCampo("contrasena", e.target.value)}
          />
        </div>

        <div className="field">
          <label>PIN (si aplica al perfil 1)</label>
          <input
            value={form.pin}
            onChange={(e) => actualizarCampo("pin", e.target.value)}
          />
        </div>

        <div className="field">
          <label>Cantidad de perfiles que gestionás</label>
          <input
            type="number"
            min={1}
            value={form.cantidadPerfiles}
            onChange={(e) => actualizarCampo("cantidadPerfiles", e.target.value)}
            required
            disabled={!!form.numerosPerfiles}
          />
        </div>

        <div className="field">
          <label>Números de perfil específicos (opcional)</label>
          <input
            value={form.numerosPerfiles}
            onChange={(e) => actualizarCampo("numerosPerfiles", e.target.value)}
            placeholder="Ej: 4,5 (si el proveedor te asignó perfiles puntuales)"
          />
          <span className="card-sub">
            Dejalo vacío si gestionás toda la cuenta (se numeran 1, 2, 3... solos).
            Completalo solo si el proveedor te dio perfiles puntuales de una
            cuenta compartida con otros.
          </span>
        </div>

        <div className="field">
          <label>Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => actualizarCampo("notas", e.target.value)}
          />
        </div>

        <button className="btn btn-block" type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cuenta"}
        </button>
      </form>
    </div>
  );
}
