import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import logoAgendcut from '../assets/Logo.svg';

// Función de login seguro
const loginUsuario = async (email, password) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) throw new Error('Correo o contraseña incorrectos');

    const userId = authData.user.id;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) throw new Error('Error obteniendo el perfil del usuario');

    return {
      success: true,
      user: authData.user,
      role: profileData.role
    };

  } catch (error) {
    console.error("Error en login:", error.message);
    return { success: false, error: error.message };
  }
};

const Login = () => {
  const navigate = useNavigate();
  
  // Estado de vistas: 'login', 'registro', 'recuperar'
  const [vista, setVista] = useState('login');

  // Estados de los inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Manejador principal del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensajeExito('');

    // Validación estricta del formato del correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico.');
      setLoading(false);
      return;
    } else if (!emailRegex.test(email)) {
      setError('Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).');
      setLoading(false);
      return;
    }

    if (vista === 'login') {
      await ejecutarLogin();
    } else if (vista === 'registro') {
      await ejecutarRegistro();
    } else if (vista === 'recuperar') {
      await ejecutarRecuperacion();
    }

    setLoading(false);
  };

  // Lógica de iniciar sesión
  const ejecutarLogin = async () => {
    const respuesta = await loginUsuario(email, password);

    if (respuesta.success) {
      if (respuesta.role === 'admin') navigate('/admin');
      else if (respuesta.role === 'barbero') navigate('/barbero');
      else navigate('/cliente');
    } else {
      setError(respuesta.error);
    }
  };

  // Lógica de crear cuenta
  const ejecutarRegistro = async () => {
    // Validación de número celular Colombia (Exactamente 10 dígitos, empieza con 3)
    const telefonoRegex = /^3\d{9}$/;
    if (!telefonoRegex.test(telefono)) {
      setError('El celular debe ser válido en Colombia (10 dígitos empezando por 3).');
      return;
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: nombre
          }
        }
      });

      if (signUpError) throw new Error(signUpError.message);

      if (authData?.user) {
        // En lugar de upsert suelto, uso de un arreglo en insert que es el estándar recomendado para profiles
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            full_name: nombre,
            phone: telefono,   
            role: 'client'     
          }
        ]);

        if (profileError) {
          console.error("Error al inyectar nombre en perfiles:", profileError);
          throw new Error('Error al guardar el nombre en el perfil (' + profileError.message + ')');
        }
      }

      // Si es correcto, se loguea y se redirecciona al panel cliente
      navigate('/cliente');

    } catch (err) {
      setError('Error al registrarse: ' + err.message);
    }
  };

  // Lógica de recuperar contraseña
  const ejecutarRecuperacion = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico primero.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw new Error(error.message);

      setMensajeExito('¡Listo! Revisa tu bandeja de entrada o carpeta de SPAM. Te enviamos un enlace para cambiar tu contraseña.');
      setEmail('');
    } catch (err) {
      setError('Error al enviar el correo: ' + err.message);
    }
  };

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setError('');
    setMensajeExito('');
  };

  // Validar el correo al salir de la casilla (onBlur)
  const validarCorreoAlSalir = () => {
    if (!email) return; 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).');
    } else if (error === 'Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).') {
      setError('');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo-container">
          <img src={logoAgendcut} alt="AgendCut Logo" className="login-logo-img" />
        </div>

        {/* Textos de bienvenida dinámicos */}
        <div className="login-welcome">
          <h1 className="login-title">
            {vista === 'login' ? 'Bienvenido a AgendCut' : vista === 'registro' ? 'Crear Cuenta' : 'Recuperar Cuenta'}
          </h1>
          <p className="login-subtitle">
            {vista === 'login' ? 'PANEL DE ACCESO' : vista === 'registro' ? 'REGISTRO DE CLIENTES' : 'RESTABLECER CONTRASEÑA'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          {mensajeExito && <div className="login-error" style={{ backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }}>{mensajeExito}</div>}

          {vista === 'registro' && (
            <>
              <div className="input-group">
                <label>Nombre completo</label>
                <input 
                  type="text" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ej: Steven Tarazona" 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Celular (Colombia)</label>
                <input 
                  type="tel" 
                  value={telefono} 
                  onChange={(e) => setTelefono(e.target.value)} 
                  placeholder="Ej: 3001234567" 
                  maxLength="10"
                  required 
                />
              </div>
            </>
          )}

          <div className="input-group">
            <label>Correo electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Si había error de correo, limpiar mientras el usuario corrige
                if (error === 'Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).') {
                  setError('');
                }
              }}
              onBlur={validarCorreoAlSalir}
              placeholder={vista === 'login' ? "username@correo.com" : "tu@correo.com"}
              required 
            />
          </div>

          {vista !== 'recuperar' && (
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Contraseña</label>
                {vista === 'login' && (
                  <span onClick={() => cambiarVista('recuperar')} style={{ fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    ¿Olvidaste tu contraseña?
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required 
                  minLength="6"
                  style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6B7280',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : (
              vista === 'login' ? 'Iniciar sesión' : 
              vista === 'registro' ? 'Crear cuenta' : 'Enviar enlace'
            )}
          </button>
        </form>

        {/* Enlaces para cambiar de pantalla */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          {vista === 'login' && (
            <p style={{ margin: 0 }}>¿No tienes cuenta? <span onClick={() => cambiarVista('registro')} style={{ cursor: 'pointer', fontWeight: 'bold' }}>Regístrate aquí</span></p>
          )}
          {vista === 'registro' && (
            <p style={{ margin: 0 }}>¿Ya tienes cuenta? <span onClick={() => cambiarVista('login')} style={{ cursor: 'pointer', fontWeight: 'bold' }}>Inicia sesión</span></p>
          )}
          {vista === 'recuperar' && (
            <span onClick={() => cambiarVista('login')} style={{ cursor: 'pointer', fontWeight: 'bold' }}>Volver a iniciar sesión</span>
          )}
        </div>

      </div>
    </div>
  );
};

export default Login;