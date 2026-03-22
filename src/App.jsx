import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase/client';

import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import GestionCitas from './pages/GestionCitas';
import GestionServicios from './pages/GestionServicios';
import GestionBarberos from './pages/GestionBarberos';
import Estadisticas from './pages/Estadisticas';
import Inventario from './pages/Inventario';
import BarberoDashboard from './pages/BarberoDashboard';
import ClienteDashboard from './pages/ClienteDashboard';
import ResetPassword from './pages/ResetPassword';


import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setIsInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchRole(newSession.user.id);
      } else {
        setRole(null);
        setIsInitializing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      // Se unifica el rol por defecto al estandar de base de datos 'client'
      setRole(data?.role || 'client');
    } catch (error) {
      console.error("Error al obtener rol:", error);
      setRole('client');
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#FDFBF7' }}>Iniciando sistema...</div>;
  }

  // El guardia de seguridad (anti-bucles)
  const RequireAuth = ({ children, allowedRole }) => {
    if (!session) return <Navigate to="/login" replace />;
    
    // Prevención de el Bucle Blanco: Si por alguna razón el rol aún no está definido en el estado, visualización de carga.
    if (!role) {
      return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#FDFBF7' }}>Verificando permisos...</div>;
    }
    
    // Si tiene sesión pero intenta entrar a un panel que no es suyo, lo redirección a a su panel OFICIAL.
    if (allowedRole && role !== allowedRole) {
      if (role === 'admin') return <Navigate to="/admin" replace />;
      if (role === 'barbero') return <Navigate to="/barbero" replace />;
      if (role === 'client' || role === 'cliente') return <Navigate to="/cliente" replace />;
      // Fallback de seguridad estricto
      return <Navigate to="/" replace />;
    }
    
    return children;
  };

  const getRedirectPath = () => {
    if (role === 'admin') return "/admin";
    if (role === 'barbero') return "/barbero";
    return "/cliente";
  };

  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#FDFBF7' }}>
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={
              !session ? <Navigate to="/login" replace /> : <Navigate to={getRedirectPath()} replace />
            } />

            <Route path="/login" element={
              session ? <Navigate to={getRedirectPath()} replace /> : <Login />
            } />

            {/* RUTAS ADMIN */}
            <Route path="/admin" element={<RequireAuth allowedRole="admin"><AdminDashboard /></RequireAuth>} />
            <Route path="/citas" element={<RequireAuth allowedRole="admin"><GestionCitas /></RequireAuth>} />
            <Route path="/servicios" element={<RequireAuth allowedRole="admin"><GestionServicios /></RequireAuth>} />
            <Route path="/barberos" element={<RequireAuth allowedRole="admin"><GestionBarberos /></RequireAuth>} />
            <Route path="/estadisticas" element={<RequireAuth allowedRole="admin"><Estadisticas /></RequireAuth>} />
            <Route path="/inventario" element={<RequireAuth allowedRole="admin"><Inventario /></RequireAuth>} />

            {/* RUTA BARBERO */}
            <Route path="/barbero" element={<RequireAuth allowedRole="barbero"><BarberoDashboard /></RequireAuth>} />

            {/* RUTA CLIENTE */}
            <Route path="/cliente" element={<RequireAuth allowedRole="client"><ClienteDashboard /></RequireAuth>} />

            {/* RUTA PÚBLICA: RESTABLECER CONTRASEÑA */}
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </main>
        
        {/* FOOTER GLOBAL PROFESIONAL */}
        <footer style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '0.85rem',
          backgroundColor: 'transparent',
          marginTop: 'auto',
          zIndex: 10
        }}>
          <strong>AgendCut &copy; {new Date().getFullYear()}</strong> | Plataforma web desarrollada por el <strong>Ing. Danny Novoa</strong>.
        </footer>
      </div>
    </Router>
  );
}

export default App;