import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, ChevronDown } from 'lucide-react';
import logoAgendcut from '../assets/Logo.svg';
import { serviciosService } from '../services/serviciosService';

const GestionServicios = () => {
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [mostrarCatalogoMovil, setMostrarCatalogoMovil] = useState(false); // Toggle para móvil
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const [formData, setFormData] = useState({
    nombre: '',
    precio: '',
    duracion_minutos: ''
  });

  useEffect(() => {
    cargarServicios();
  }, []);

  // Efecto para detectar scroll y ocultar/mostrar el header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsHeaderVisible(false); // Scroll hacia abajo
      } else {
        setIsHeaderVisible(true); // Scroll hacia arriba
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const cargarServicios = async () => {
    try {
      setLoading(true);
      const data = await serviciosService.obtenerServiciosActivos();
      setServicios(data || []);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validación estricta para que precio y duración sean solo números enteros
    if (name === 'precio' || name === 'duracion_minutos') {
      const soloNumeros = value.replace(/[^0-9]/g, ''); // Elimina cualquier carácter que no sea del 0 al 9
      setFormData({ ...formData, [name]: soloNumeros });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Función para seleccionar una tarjeta de la lista (Lado derecho)
  const seleccionarServicio = (servicio) => {
    setServicioSeleccionado(servicio);
    setFormData({
      nombre: servicio.nombre,
      precio: servicio.precio,
      duracion_minutos: servicio.duracion_minutos
    });
    setMostrarCatalogoMovil(false); // Ocultar el catálogo si se selecciona una tarjeta desde el móvil
  };

  // Función para limpiar el formulario
  const limpiarFormulario = () => {
    setServicioSeleccionado(null);
    setFormData({ nombre: '', precio: '', duracion_minutos: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // Convertir a números enteros antes de enviarlos
      const datosAEnviar = {
        ...formData,
        precio: parseInt(formData.precio, 10),
        duracion_minutos: parseInt(formData.duracion_minutos, 10)
      };

      if (servicioSeleccionado) {
        await serviciosService.actualizarServicio(servicioSeleccionado.id, datosAEnviar);
      } else {
        await serviciosService.crearServicio(datosAEnviar);
      }
      limpiarFormulario();
      cargarServicios();
    } catch (error) {
      console.error("Error al guardar servicio:", error);
      alert("Error al guardar los datos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar este servicio del catálogo?");
    if (!confirmar) return;

    try {
      setSaving(true);
      await serviciosService.eliminarServicio(servicioSeleccionado.id);
      limpiarFormulario();
      cargarServicios();
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar el servicio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n">
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">SERVICIOS</span>
            </div>
          </div>
          <button onClick={() => navigate('/admin')} className="n8n-back-button">
            <ArrowLeft size={18} /> <span className="back-text">Volver al panel</span>
          </button>
        </div>
      </header>
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 className="admin-subtitle">Catálogo y precios</h2>
        <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: 0 }}>Gestión de servicios</h1>
      </div>

      <div className="split-layout">
        <div className="admin-form-panel">
          <div className="panel-header">
            <div className="header-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '1rem'}}>
              <h3>{servicioSeleccionado ? 'Editar servicio' : 'Añadir nuevo servicio'}</h3>
              {servicioSeleccionado && (
                <span className="badge-editing">Modo edición</span>
              )}
            </div>
            {/* BOTÓN MÓVIL (Visible solo en CSS para <=768px) para desplegar catálogo */}
            <button 
              className="mobile-catalog-toggle" 
              onClick={() => setMostrarCatalogoMovil(!mostrarCatalogoMovil)}
            >
              <span>{mostrarCatalogoMovil ? 'Ocultar Catálogo' : 'Ver Catálogo'}</span>
              <ChevronDown 
                size={18} 
                style={{ 
                  transform: mostrarCatalogoMovil ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} 
              />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="panel-form">
            <div className="input-group">
              <label>Nombre del servicio</label>
              <input 
                type="text" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleInputChange} 
                placeholder="Ej. Corte Clásico" 
                required 
              />
            </div>
            
            <div className="form-row">
              <div className="input-group">
                <label>Precio fijado ($)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="precio" 
                  value={formData.precio} 
                  onChange={handleInputChange} 
                  placeholder="Ej. 25000" 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Duración (Minutos)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="duracion_minutos" 
                  value={formData.duracion_minutos} 
                  onChange={handleInputChange} 
                  placeholder="Ej. 30" 
                  required 
                />
              </div>
            </div>

            <div className="panel-footer">
              {servicioSeleccionado ? (
                <>
                  <button type="button" className="delete-button-text" onClick={handleDelete} disabled={saving}>
                    Eliminar
                  </button>
                  <div className="panel-actions">
                    <button type="button" className="cancel-button" onClick={limpiarFormulario}>Cancelar</button>
                    <button type="submit" className="primary-button" disabled={saving}>
                      {saving ? <Loader2 className="spinner" size={18} /> : 'Actualizar'}
                    </button>
                  </div>
                </>
              ) : (
                <button type="submit" className="primary-button full-width" disabled={saving}>
                  {saving ? <Loader2 className="spinner" size={18} /> : 'Guardar servicio'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LADO DERECHO: CATÁLOGO DE SERVICIOS EN CAJA (TARJETAS PLANAS) */}
        <div className={`admin-list-panel ${mostrarCatalogoMovil ? 'show-on-mobile' : ''}`}>
          <div className="panel-header">
            <h3>Catálogo actual</h3>
            <span className="badge-editing" style={{ backgroundColor: '#F3F4F6', color: 'var(--text-secondary)'}}>
              {servicios.length} Servicios
            </span>
          </div>

          <div className="panel-list-content">
            {loading ? (
              <div className="loading-state"><Loader2 className="spinner" size={40} color="#B08D28" /></div>
            ) : servicios.length === 0 ? (
              <div className="empty-state">
                <p>No hay servicios en el catálogo.</p>
              </div>
            ) : (
              <div className="flat-cards-container">
                {servicios.map((servicio) => (
                  <div 
                    key={servicio.id} 
                    className={`flat-service-card ${servicioSeleccionado?.id === servicio.id ? 'selected' : ''}`}
                    onClick={() => seleccionarServicio(servicio)}
                  >
                    <div className="flat-card-info">
                      <h4 className="flat-card-title">{servicio.nombre}</h4>
                      <span className="flat-card-badge">{servicio.duracion_minutos} min</span>
                    </div>
                    <div className="flat-card-price">
                      ${servicio.precio?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GestionServicios;