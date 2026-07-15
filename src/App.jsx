import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import Login from "./login/Login";
import ListaCuentas from "./cuentas/ListaCuentas";
import AgregarCuenta from "./cuentas/AgregarCuenta";
import DetalleCuenta from "./cuentas/DetalleCuenta";
import Vencimientos from "./vencimientos/Vencimientos";

// Menú de usuario (⋮): vive acá porque solo lo usa la barra superior.
function MenuUsuario() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="menu-usuario">
      <button
        className="link"
        aria-label="Menú"
        onClick={() => setAbierto((v) => !v)}
      >
        ⋮
      </button>
      {abierto && (
        <>
          <div className="menu-backdrop" onClick={() => setAbierto(false)} />
          <div className="menu-dropdown">
            <button onClick={() => signOut(auth)}>Cerrar sesión</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = todavía no sabemos

  useEffect(() => {
    return onAuthStateChanged(auth, setUsuario);
  }, []);

  if (usuario === undefined) return null; // evita parpadeo mientras Firebase resuelve la sesión
  if (usuario === null) return <Login />;

  return (
    <BrowserRouter>
      <div className="topbar">
        <h1>Gestor de Cuentas</h1>
        <nav>
          <NavLink to="/" end>
            Cuentas
          </NavLink>
          <NavLink to="/vencimientos">Vencimientos</NavLink>
          <MenuUsuario />
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<ListaCuentas />} />
        <Route path="/nueva" element={<AgregarCuenta />} />
        <Route path="/cuentas/:cuentaId" element={<DetalleCuenta />} />
        <Route path="/vencimientos" element={<Vencimientos />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
