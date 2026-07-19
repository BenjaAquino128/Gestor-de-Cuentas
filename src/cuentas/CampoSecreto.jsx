import { useState } from "react";

// Input o texto con ojito para revelar/ocultar (contraseña, PIN). Por defecto oculto.
export default function CampoSecreto({
  value,
  onChange,
  placeholder,
  etiqueta,
  modo = "input", // "input" | "texto"
  onCopiar,
  compact = false, // sin wrapper .field (ej. PIN en fila de perfil)
}) {
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!onCopiar || !value) return;
    await navigator.clipboard.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  const mostrado = visible ? value || "" : value ? "••••••••" : "(sin datos)";

  if (modo === "texto") {
    return (
      <div className="field">
        {etiqueta && <label>{etiqueta}</label>}
        <div className="copiable">
          <span>{mostrado || "(sin datos)"}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Ocultar" : "Mostrar"}
            >
              {visible ? "🙈" : "👁"}
            </button>
            {onCopiar && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={copiar}
                disabled={!value}
              >
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const control = (
    <div className={`input-secreto${compact ? " input-secreto-compact" : ""}`}>
      <input
        type={visible ? "text" : "password"}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        style={compact ? { width: 80 } : undefined}
      />
      <button
        type="button"
        className="btn-ojito"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? "🙈" : "👁"}
      </button>
    </div>
  );

  if (compact) return control;

  return (
    <div className="field">
      {etiqueta && <label>{etiqueta}</label>}
      {control}
    </div>
  );
}
