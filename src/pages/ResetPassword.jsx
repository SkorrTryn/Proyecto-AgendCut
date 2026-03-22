import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import logoAgendcut from '../assets/Logo.svg';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Supabase maneja el token de la URL automáticamente al detectar el evento PASSWORD_RECOVERY
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // El usuario llegó con un token válido. La sesión ya está activa.
        console.log('Token de recuperación detectado. Listo para actualizar.');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifica.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setExito(true);
      // Redirigir al login después de 3 segundos
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError('Error al actualizar la contraseña: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo-container">
          <img src={logoAgendcut} alt="AgendCut Logo" className="login-logo-img" />
        </div>

        <div className="login-welcome">
          <h1 className="login-title">Nueva contraseña</h1>
          <p className="login-subtitle">RESTABLECER ACCESO</p>
        </div>

        {exito ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '1rem', padding: '2rem 0', textAlign: 'center'
          }}>
            <div style={{
              backgroundColor: '#D1FAE5', borderRadius: '50%',
              width: '70px', height: '70px', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle color="#059669" size={36} />
            </div>
            <h3 style={{ color: '#111827', fontWeight: 700, margin: 0 }}>¡Contraseña actualizada!</h3>
            <p style={{ color: '#6B7280', fontSize: '0.95rem', margin: 0 }}>
              Serás redirigido al inicio de sesión en unos segundos...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}

            {/* Nueva contraseña */}
            <div className="input-group">
              <label>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength="6"
                  style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#6B7280',
                    display: 'flex', alignItems: 'center', padding: '5px'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="input-group">
              <label>Confirmar contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength="6"
                  style={{ width: '100%', paddingRight: '45px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#6B7280',
                    display: 'flex', alignItems: 'center', padding: '5px'
                  }}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? <Loader2 className="spinner" size={20} /> : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          <span
            onClick={() => navigate('/login')}
            style={{ cursor: 'pointer', fontWeight: 'bold' }}
          >
            Volver al inicio de sesión
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
