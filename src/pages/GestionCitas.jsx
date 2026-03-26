import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Plus, Calendar as CalendarIcon, X, ChevronDown, Clock, User } from 'lucide-react';
import logoAgendcut from '../assets/Logo.svg';

import { citasService } from '../services/citasService'; 
import { serviciosService } from '../services/serviciosService';
import { barberosService } from '../services/barberosService'; // 
import imgRechazo from '../assets/rechazo.png';

const GestionCitas = () => {
  const navigate = useNavigate();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [citaIdActual, setCitaIdActual] = useState(null);
  
  const [serviciosList, setServiciosList] = useState([]);
  const [barberosList, setBarberosList] = useState([]); // 

  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente_nombre: '',
    servicio: [], 
    barbero_id: '', // <---
    fecha: '',
    hora: '',
    precio: '', 
    estado: 'Pendiente'
  });

  useEffect(() => {
    cargarDatosPantalla();
  }, []);

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

  const cargarDatosPantalla = async () => {
    try {
      setLoading(true);
      // Extracción de las 3 tablas al mismo tiempo
      const [citasData, serviciosData, barberosData] = await Promise.all([
        citasService.obtenerCitas(),
        serviciosService.obtenerServiciosActivos(),
        barberosService.obtenerBarberos()
      ]);
      
      setCitas(citasData || []);
      setServiciosList(serviciosData || []);
      setBarberosList(barberosData || []);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleServiceMultiSelect = (servicioNombre) => {
    const currentServices = Array.isArray(formData.servicio) ? formData.servicio : [];
    const index = currentServices.indexOf(servicioNombre);
    
    let updatedServices;
    if (index > -1) {
      updatedServices = currentServices.filter(s => s !== servicioNombre);
    } else {
      updatedServices = [...currentServices, servicioNombre];
    }
    
    const selectedServicesData = serviciosList.filter(s => updatedServices.includes(s.nombre));
    const totalPrice = selectedServicesData.reduce((sum, s) => sum + Number(s.precio), 0);
    
    setFormData({ 
      ...formData, 
      servicio: updatedServices, 
      precio: totalPrice 
    });
  };

  const abrirModalCrear = () => {
    setModoEdicion(false);
    setCitaIdActual(null);
    setFormData({ cliente_nombre: '', servicio: [], barbero_id: '', fecha: '', hora: '', precio: '', estado: 'Pendiente' });
    setIsModalOpen(true);
  };

  const abrirModalEditar = (cita) => {
    setModoEdicion(true);
    setCitaIdActual(cita.id);
    
    const serviciosActivos = typeof cita.servicio === 'string' 
      ? cita.servicio.split(',').map(s => s.trim()) 
      : (cita.servicio || []);

    setFormData({
      cliente_nombre: cita.cliente_nombre,
      servicio: serviciosActivos,
      barbero_id: cita.barbero_id || '', // Carga de el dueño actual de la cita
      fecha: cita.fecha,
      hora: cita.hora,
      precio: cita.precio,
      estado: cita.estado
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.barbero_id) {
      alert("Por favor, selecciona al profesional que atenderá esta cita.");
      return;
    }

    try {
      setSaving(true);

      // 1. cálculo del bloque de tiempo de la nueva cita
      // Convertimos la hora (Ej: "13:30") a minutos totales desde la medianoche para poder sumar
      const [horasNuevas, minutosNuevos] = formData.hora.split(':').map(Number);
      const inicioNuevoMinutos = horasNuevas * 60 + minutosNuevos;

      // Cálculo de cuánto dura sumando los minutos de los servicios seleccionados
      const serviciosSeleccionados = serviciosList.filter(s => formData.servicio.includes(s.nombre));
      const duracionNueva = serviciosSeleccionados.reduce((sum, s) => sum + Number(s.duracion_minutos), 0) || 30; // 30 min por defecto
      const finNuevoMinutos = inicioNuevoMinutos + duracionNueva;

      // 2. filtrado de las citas del mismo día y barbero
      const citasDelDia = citas.filter(c => 
        c.barbero_id === formData.barbero_id && 
        c.fecha === formData.fecha && 
        c.estado !== 'Cancelada' &&
        c.id !== (modoEdicion ? citaIdActual : null) // Si editamos, ignoramos la cita actual para que no choque consigo misma
      );

      // 3. escudo antichoques (comparación de rangos)
      let hayChoque = false;

      for (let citaExistente of citasDelDia) {
        // A. Calcular inicio de la cita existente en minutos
        const [h, m] = citaExistente.hora.split(':').map(Number);
        const inicioExistente = h * 60 + m;

        // B. Calcular fin de la cita existente
        // (aseguramiento de que los servicios sean un array para buscarlos)
        const nombresServiciosExistentes = Array.isArray(citaExistente.servicio) 
          ? citaExistente.servicio 
          : (typeof citaExistente.servicio === 'string' ? citaExistente.servicio.split(',').map(s=>s.trim()) : []);

        const detallesServiciosExistentes = serviciosList.filter(s => nombresServiciosExistentes.includes(s.nombre));
        const duracionExistente = detallesServiciosExistentes.reduce((sum, s) => sum + Number(s.duracion_minutos), 0) || 30;
        const finExistente = inicioExistente + duracionExistente;

        // C. LA REGLA DE SOLAPAMIENTO: (InicioA < FinB) Y (FinA > InicioB)
        if (inicioNuevoMinutos < finExistente && finNuevoMinutos > inicioExistente) {
          hayChoque = true;
          break; // Detenemos la búsqueda, ya encontramos el choque
        }
      }

      // Si choca, levantamos el escudo y detenemos el guardado
      if (hayChoque) {
        setShowWarning(true); 
        setSaving(false);
        return; 
      }
      // =====================================

      // Si pasa la validación, almacenamiento de en base de datos
      if (modoEdicion) {
        await citasService.actualizarCita(citaIdActual, formData);
      } else {
        await citasService.crearCita(formData);
      }
      
      setIsModalOpen(false);
      cargarDatosPantalla(); 
    } catch (error) {
      console.error("Error al guardar cita:", error);
      alert("Hubo un error al guardar los datos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmar = window.confirm("¿Estás seguro de que deseas eliminar esta cita? Esta acción es irreversible.");
    if (!confirmar) return;

    try {
      setSaving(true);
      await citasService.eliminarCita(citaIdActual);
      setIsModalOpen(false);
      cargarDatosPantalla();
    } catch (error) {
      console.error("Error al eliminar cita:", error);
    } finally {
      setSaving(false);
    }
  };

  const getEstadoClass = (estado) => {
    switch (estado?.toLowerCase()) {
      case 'completada': return 'status-completed';
      case 'cancelada': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const fechaMinima = new Date().toISOString().split('T')[0];

  const formatoAMPM = (hora24) => {
    if (!hora24) return '';
    let [h, m] = hora24.substring(0, 5).split(':');
    let horas = parseInt(h, 10);
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12 || 12; 
    return `${horas}:${m} ${ampm}`;
  };

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin')}>
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">CITAS</span>
            </div>
          </div>
          <button onClick={() => navigate('/admin')} className="n8n-back-button">
            <ArrowLeft size={18} /> <span className="back-text">Volver al panel</span>
          </button>
        </div>
      </header>

      <div className="welcome-section">
        <h2 className="admin-subtitle">Agenda central</h2>
        <div className="header-actions">
          <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: 0 }}>Gestión de citas</h1>
          <button className="primary-button" onClick={abrirModalCrear}>
            <Plus size={18} /> Nueva cita
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={40} color="#B08D28" />
            <p>Cargando agenda...</p>
          </div>
        ) : citas.length === 0 ? (
          <div className="empty-state">
            <CalendarIcon size={48} color="#E5E7EB" />
            <p>No hay citas programadas.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Cliente</th>
                  <th>Profesional</th> 
                  <th>Servicio</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td>
                      <div className="date-cell">
                        <span className="date-text">{cita.fecha}</span>
                        <span className="time-text">{formatoAMPM(cita.hora)}</span>  
                      </div>
                    </td>
                    <td className="fw-600">{cita.cliente_nombre}</td>
                    
                    <td>
                      {cita.barberos ? (
                        <div className="table-barber-info">
                          {cita.barberos.foto_url ? (
                            <img src={cita.barberos.foto_url} alt="Barbero" className="table-barber-avatar" />
                          ) : (
                            <div className="table-barber-avatar placeholder"><User size={14} /></div>
                          )}
                          <span className="table-barber-name">{cita.barberos.nombre.split(' ')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-muted" style={{fontSize: '0.85rem'}}>Sin asignar</span>
                      )}
                    </td>

                    <td>
                      {Array.isArray(cita.servicio) ? (
                        <span className="services-list-table">
                          {cita.servicio.join(', ')} 
                        </span>
                      ) : (
                        cita.servicio 
                      )}
                    </td>
                    <td>${cita.precio?.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${getEstadoClass(cita.estado)}`}>
                        {cita.estado}
                      </span>
                    </td>
                    <td>
                      <button className="action-link" onClick={() => abrirModalEditar(cita)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{modoEdicion ? 'Editar cita' : 'Agendar nueva cita'}</h3>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="input-group">
                <label>Nombre del cliente</label>
                <input type="text" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleInputChange} required placeholder="Ej. Juan Pérez" />
              </div>

              <div className="input-group">
                <label>Profesional asignado</label>
                <select 
                  name="barbero_id" 
                  value={formData.barbero_id} 
                  onChange={handleInputChange} 
                  className="modal-select" 
                  required
                >
                  <option value="">-- Selecciona quién atenderá --</option>
                  {barberosList.map(barbero => (
                    <option key={barbero.id} value={barbero.id}>
                      {barbero.nombre}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="input-group multi-service-group">
                <label>Servicio(s) (Calculadora de total)</label>
                <div 
                  className={`multi-service-select ${isServiceDropdownOpen ? 'active' : ''}`}
                  onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                >
                  <div className="selected-services-summary">
                    {formData.servicio.length === 0 ? (
                      <span className="placeholder-text">Seleccione uno o más servicios...</span>
                    ) : (
                      <span className="summary-text">
                        ({formData.servicio.length}) {formData.servicio.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}
                      </span>
                    )}
                  </div>
                  <ChevronDown size={18} className="chevron-icon" />
                </div>

                {isServiceDropdownOpen && (
                  <div className="multi-service-dropdown">
                    <div className="dropdown-options">
                      {serviciosList.map((srv) => (
                        <label
                          key={srv.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #F3F4F6',
                            backgroundColor: formData.servicio.includes(srv.nombre) ? 'rgba(176,141,40,0.06)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            name="servicio_multi" 
                            value={srv.nombre} 
                            checked={formData.servicio.includes(srv.nombre)}
                            onChange={() => handleServiceMultiSelect(srv.nombre)} 
                            style={{ width: '18px', height: '18px', flexShrink: 0, accentColor: '#B08D28', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {srv.nombre}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={11} style={{ flexShrink: 0 }} /> {srv.duracion_minutos} min
                              <span style={{ opacity: 0.4 }}>•</span>
                              <span style={{ color: '#B08D28', fontWeight: 600 }}>${srv.precio?.toLocaleString()}</span>
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label>Fecha</label>
                  <input 
                    type="date" 
                    name="fecha" 
                    value={formData.fecha} 
                    onChange={handleInputChange} 
                    min={fechaMinima} 
                    required 
                  />
                </div>
                <div className="input-group">
                  <label>Hora</label>
                  <input type="time" name="hora" value={formData.hora} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="input-group">
                <label>Precio fijado sumado ($)</label>
                <input 
                  type="text" 
                  name="precio" 
                  value={formData.precio?.toLocaleString()} 
                  readOnly 
                  style={{ backgroundColor: '#E5E7EB', color: '#6B7280', cursor: 'not-allowed', fontWeight: 700 }}
                />
              </div>

              {modoEdicion && (
                <div className="input-group">
                  <label>Estado de la cita</label>
                  <select name="estado" value={formData.estado} onChange={handleInputChange} className="modal-select">
                    <option value="Pendiente">Pendiente</option>
                    <option value="Completada">Completada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              )}

              <div className="modal-footer" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {modoEdicion && (
                  <button type="button" className="delete-button" onClick={handleDelete} disabled={saving}>
                    Eliminar cita
                  </button>
                )}
                <button type="button" className="cancel-button" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <Loader2 className="spinner" size={18} /> : (modoEdicion ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="warning-card">
            <button className="close-warning" onClick={() => setShowWarning(false)}>
              <X size={20} />
            </button>
            <div className="warning-body"> 
              <img src={imgRechazo} alt="Horario ocupado" className="warning-icon" />
              <div className="warning-text-content">
                <h4 className="warning-heading">Este profesional ya tiene una cita activa para esta fecha y hora.</h4>
                <p className="warning-paragraph">Por favor, selecciona un horario distinto o asigna a otro profesional.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionCitas;