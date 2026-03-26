import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Upload, Edit, Trash2, User, DollarSign, Briefcase, Camera, Calendar, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase/client';
import { barberosService } from '../services/barberosService';
import { serviciosService } from '../services/serviciosService';
import logoAgendcut from '../assets/Logo.svg';

// Generador dinámico de meses
const generarOpcionesMeses = () => {
  const opciones = [];
  const hoy = new Date();
  
  for (let i = 0; i < 12; i++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const value = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    
    let label = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    label = label.charAt(0).toUpperCase() + label.slice(1); 
    
    opciones.push({ value, label });
  }
  return opciones;
};

const GestionBarberos = () => {
  const navigate = useNavigate();
  const [barberos, setBarberos] = useState([]);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [citasMes, setCitasMes] = useState([]); 
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados del selector de meses
  const [opcionesMeses] = useState(generarOpcionesMeses());
  const [mesSeleccionado, setMesSeleccionado] = useState(opcionesMeses[0].value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [barberoIdActual, setBarberoIdActual] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '', email: '', telefono: '', password: '', servicios_especialidad: []
  });

  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // El effect ahora escucha al mes seleccionado
  useEffect(() => {
    cargarDatosGenerales();
  }, [mesSeleccionado]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const cargarDatosGenerales = async () => {
    try {
      setLoading(true);
      
      // Logica matemática del Tiempo
      const [year, month] = mesSeleccionado.split('-');
      
      const formatYYYYMMDD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const primerDiaObj = new Date(year, Number(month) - 1, 1);
      const ultimoDiaObj = new Date(year, Number(month), 0); 
      
      const primerDia = formatYYYYMMDD(primerDiaObj);
      const ultimoDia = formatYYYYMMDD(ultimoDiaObj);

      // Extracción de todo en paralelo
      const [barberosData, serviciosData, citasData] = await Promise.all([
        barberosService.obtenerBarberos(),
        serviciosService.obtenerServiciosActivos(),
        supabase.from('citas').select('barbero_id, precio, estado').gte('fecha', primerDia).lte('fecha', ultimoDia)
      ]);

      setBarberos(barberosData || []);
      setCatalogoServicios(serviciosData || []);
      setCitasMes(citasData.data || []);
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularMetricas = (barberoId) => {
    // Filtrado de las citas de ESTE barbero que estén COMPLETADAS en el mes seleccionado
    const citasDelBarbero = citasMes.filter(cita => cita.barbero_id === barberoId && cita.estado === 'Completada');
    const totalServicios = citasDelBarbero.length;
    const ganancias = citasDelBarbero.reduce((sum, cita) => sum + Number(cita.precio), 0);
    return { totalServicios, ganancias };
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert("Por favor, sube una imagen en formato JPG, PNG o WEBP.");
      return;
    }

    const maxSize = 8 * 1024 * 1024; // 8MB
    if (file.size > maxSize) {
      alert("La imagen es muy pesada. El tamaño máximo permitido es de 8MB.");
      return;
    }

    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file)); 
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEspecialidadToggle = (servicioNombre) => {
    const especialidades = formData.servicios_especialidad;
    if (especialidades.includes(servicioNombre)) {
      setFormData({ ...formData, servicios_especialidad: especialidades.filter(s => s !== servicioNombre) });
    } else {
      setFormData({ ...formData, servicios_especialidad: [...especialidades, servicioNombre] });
    }
  };

  const abrirModalCrear = () => {
    setModoEdicion(false);
    setBarberoIdActual(null);
    setFormData({ nombre: '', email: '', telefono: '', password: '', servicios_especialidad: [] });
    setFotoFile(null);
    setFotoPreview(null);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (barbero) => {
    setModoEdicion(true);
    setBarberoIdActual(barbero.id);
    setFormData({
      nombre: barbero.nombre,
      email: barbero.email,
      telefono: barbero.telefono || '',
      password: '', // Siempre vacío al abrir. La contraseña actual está encriptada.
      servicios_especialidad: barbero.servicios_especialidad || [],
      foto_url: barbero.foto_url 
    });
    setFotoFile(null);
    setFotoPreview(barbero.foto_url); 
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    //Si es un barbero , se exige contraseña de min 6 caracteres
    if (!modoEdicion && (!formData.password || formData.password.length < 6)) {
      alert("Para registrar un profesional nuevo, la contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setSaving(true);
      if (modoEdicion) {
        await barberosService.editarBarbero(barberoIdActual, formData, fotoFile);
      } else {
        await barberosService.crearBarbero(formData, fotoFile);
      }
      setIsModalOpen(false);
      cargarDatosGenerales();
    } catch (error) {
      console.error("Error al guardar barbero:", error);
      alert("Hubo un error al guardar. Verifica que el correo no esté repetido.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas desactivar a este profesional?")) return;
    try {
      await barberosService.eliminarBarbero(id);
      cargarDatosGenerales();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  const getMesActualLabel = () => {
    return opcionesMeses.find(op => op.value === mesSeleccionado)?.label || 'Seleccionar mes';
  };

  const nombreMesCorto = getMesActualLabel().split(' ')[0]; // Ej: "Marzo" para las tarjetas

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin')}>
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">ADMIN</span>
            </div>
          </div>
          <button onClick={() => navigate('/admin')} className="n8n-back-button">
            <ArrowLeft size={18} /> <span className="back-text">Volver al panel</span>
          </button>
        </div>
      </header>

      
      <div className="welcome-section header-balanced" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="titles-container">
          <h2 className="admin-subtitle">Gestión de equipo</h2>
          <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: 0 }}>Profesionales</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="month-selector-container custom-dropdown">
            <button 
              className={`month-selector-trigger ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={loading}
            >
              <div className="trigger-left">
                <Calendar size={18} className="calendar-icon" />
                <span className="current-month-text">{getMesActualLabel()}</span>
              </div>
              <ChevronDown size={18} className="chevron-icon" />
            </button>

            {isDropdownOpen && (
              <div className="month-selector-menu">
                <div className="dropdown-options">
                  {opcionesMeses.map(opcion => (
                    <div 
                      key={opcion.value} 
                      className={`dropdown-item ${opcion.value === mesSeleccionado ? 'selected' : ''}`}
                      onClick={() => {
                        setMesSeleccionado(opcion.value);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {opcion.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTÓN AÑADIR BARBERO */}
          <button className="primary-button add-barbero-btn" onClick={abrirModalCrear}>
            + Añadir barbero
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><Loader2 className="spinner" size={40} color="#B08D28" /></div>
      ) : barberos.length === 0 ? (
        <div className="empty-state"><p>No hay profesionales registrados en el equipo.</p></div>
      ) : (
        <div className="barberos-directory">
          {barberos.map((barbero) => {
            const metricas = calcularMetricas(barbero.id);

            return (
              <div key={barbero.id} className="barbero-horizontal-card">
                
                <div className="barbero-photo-section">
                  {barbero.foto_url ? (
                    <img src={barbero.foto_url} alt={barbero.nombre} className="barbero-avatar-img" />
                  ) : (
                    <div className="barbero-avatar-placeholder"><User size={32} /></div>
                  )}
                 
                </div>

                <div className="barbero-info-section">
                  <h3 className="barbero-name">{barbero.nombre}</h3>
                  <p className="barbero-contact">{barbero.email} • {barbero.telefono}</p>
                  
                  <div className="barbero-tags">
                    {barbero.servicios_especialidad?.slice(0, 3).map(esp => (
                      <span key={esp} className="specialty-tag">{esp}</span>
                    ))}
                    {barbero.servicios_especialidad?.length > 3 && (
                      <span className="specialty-tag extra">+{barbero.servicios_especialidad.length - 3} más</span>
                    )}
                  </div>
                </div>

                <div className="barbero-metrics-section">
                  <div className="metric-box">
                    <Briefcase size={16} className="metric-icon" />
                    <div className="metric-data">
                      <span className="metric-value">{metricas.totalServicios}</span>
                      <span className="metric-label">Servicios ({nombreMesCorto})</span>
                    </div>
                  </div>
                  
                  <div className="metric-box highlight">
                    <DollarSign size={16} className="metric-icon gold" />
                    <div className="metric-data">
                      <span className="metric-value">${metricas.ganancias.toLocaleString()}</span>
                      <span className="metric-label">Generado ({nombreMesCorto})</span>
                    </div>
                  </div>

                  <div className="barbero-actions">
                    <button className="action-btn edit" onClick={() => abrirModalEditar(barbero)}><Edit size={18} /></button>
                    <button className="action-btn delete" onClick={() => handleDelete(barbero.id)}><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA CREAR/EDITAR BARBERO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>{modoEdicion ? 'Editar profesional' : 'Registrar nuevo profesional'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body form-grid-layout">
              <div className="form-column">
                <div className="photo-upload-container">
                  <label className="photo-upload-box">
                    <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} hidden />
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="Preview" className="photo-preview-img" />
                    ) : (
                      <div className="photo-placeholder-content">
                        <Camera size={32} />
                        <span>Subir foto (Max 8MB)</span>
                      </div>
                    )}
                    <div className="upload-overlay"><Upload size={20} /> Cambiar</div>
                  </label>
                </div>

                <div className="input-group">
                  <label>Nombre completo</label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} autoComplete="off" required />
                </div>
                
                <div className="input-group">
                  <label>Correo electrónico (acceso)</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} autoComplete="off" required />
                </div>

                <div className="input-group">
                  <label>
                    {modoEdicion ? 'Nueva Contraseña (Opcional)' : 'Contraseña de acceso'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      name="password" 
                      value={formData.password} 
                      onChange={handleInputChange} 
                      placeholder={modoEdicion ? "Deja en blanco para conservar la actual" : "Mínimo 6 caracteres"} 
                      autoComplete="new-password" 
                      required={!modoEdicion}
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                        transition: 'color 0.2s'
                      }}
                      title="Mantén presionado para ver la contraseña"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {modoEdicion && (
                    <small style={{color: '#6B7280', fontSize: '0.8rem', marginTop: '4px'}}>
                      Por seguridad, la contraseña actual está encriptada y no se muestra. Escribe una nueva solo si el barbero olvidó la suya.
                    </small>
                  )}
                </div>
              </div>

              <div className="form-column">
                <div className="input-group">
                  <label>Teléfono (Opcional)</label>
                  <input type="text" name="telefono" value={formData.telefono} onChange={handleInputChange} autoComplete="off" placeholder="Ej. 300 123 4567" />
                </div>

                <div className="input-group">
                  <label>Especialidades (servicios que realiza)</label>
                  <div className="specialties-checkbox-list">
                    {catalogoServicios.map(servicio => (
                      <label key={servicio.id} className={`specialty-checkbox-item ${formData.servicios_especialidad.includes(servicio.nombre) ? 'selected' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={formData.servicios_especialidad.includes(servicio.nombre)}
                          onChange={() => handleEspecialidadToggle(servicio.nombre)}
                        />
                        {servicio.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

            </form>
            
            <div className="modal-footer">
              <button type="button" className="cancel-button" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="button" className="primary-button" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="spinner" size={18} /> : 'Guardar profesional'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionBarberos;