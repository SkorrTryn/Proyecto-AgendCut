import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, CheckCircle, Clock, CalendarCheck, DollarSign, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../supabase/client';
import { barberoDashboardService } from '../services/barberoDashboardService';
import logoAgendcut from '../assets/Logo.svg';

const BarberoDashboard = () => {
  const navigate = useNavigate();
  const [nombrePila, setNombrePila] = useState(null); 
  const [barberoId, setBarberoId] = useState(null);
  
  // Estado para el filtro de fecha
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);

  // Estados para la agenda
  const [citasHoy, setCitasHoy] = useState([]);
  const [cargandoAgenda, setCargandoAgenda] = useState(true);
  const [estadisticas, setEstadisticas] = useState({ pendientes: 0, completados: 0, ingresos: 0 });

  // Lógica del menú desplegable
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Estados de modales y alarmas frontend
  const [modalAdvertencia, setModalAdvertencia] = useState({ activo: false, id: null, titulo: '', mensaje: '' });
  const [toastExito, setToastExito] = useState({ activo: false, mensaje: '' });

  // Estados para ocultar header al hacer scroll
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const inicializarDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar identidad del barbero
        let idRealDelBarbero = null;

        const { data: barberoDB } = await supabase
          .from('barberos')
          .select('id, nombre') 
          .eq('email', session.user.email)
          .maybeSingle();

        if (barberoDB && barberoDB.nombre) {
          setNombrePila(barberoDB.nombre.split(' ')[0]);
          idRealDelBarbero = barberoDB.id;
          setBarberoId(barberoDB.id);
        } else {
          // Fallback al perfil
          const { data: profile } = await supabase.from('profiles').select('full_name, nombre').eq('id', session.user.id).maybeSingle();
          if (profile && (profile.full_name || profile.nombre)) {
             setNombrePila((profile.full_name || profile.nombre).split(' ')[0]);
          } else {
            setNombrePila(session.user.email.split('@')[0]);
          }
        }

        // Cargar la agenda inicial
        if (idRealDelBarbero) {
          cargarAgendaDelDia(idRealDelBarbero, fechaFiltro);
        } else {
          setCargandoAgenda(false);
        }

      } catch (error) {
        console.error("Error inicializando panel:", error);
        setCargandoAgenda(false);
      }
    };

    inicializarDashboard();
  }, []);

  // Efecto para recargar cuando cambia la fecha
  useEffect(() => {
    if (barberoId) {
      cargarAgendaDelDia(barberoId, fechaFiltro);
    }
  }, [fechaFiltro, barberoId]);

  // Función para cargar citas y calcular KPIs (actualizada para recibir fecha)
  const cargarAgendaDelDia = async (id, fecha) => {
    try {
      setCargandoAgenda(true);
      const agenda = await barberoDashboardService.obtenerCitasDelDia(id, fecha);
      setCitasHoy(agenda);
      calcularMeticas(agenda);
    } catch (error) {
      console.error(error.message);
    } finally {
      setCargandoAgenda(false);
    }
  };

  // Calcular las métricas para las tarjetas
  const calcularMeticas = (citas) => {
    let pendientes = 0;
    let completados = 0;
    let ingresos = 0;

    citas.forEach(cita => {
      // Forzaje de minúsculas para evitar errores por "Pendiente" o "Completada"
      const estado = cita.estado?.toLowerCase() || '';
      
      if (estado === 'pendiente') pendientes++;
      if (estado === 'completada' || estado === 'completado') {
        completados++;
        if (cita.precio) ingresos += Number(cita.precio); 
      }
    });

    setEstadisticas({ pendientes, completados, ingresos });
  };

  // Acción de completar 
  const solicitarCompletarCita = (citaId) => {
    setModalAdvertencia({
      activo: true,
      id: citaId,
      titulo: '¿Confirmar finalización?',
      mensaje: '¿Confirmas que terminaste este servicio? El ingreso se registrará automáticamente en el sistema.'
    });
  };

  // Confirmar acción desde el modal
  const confirmarFinalizacion = async () => {
    const citaId = modalAdvertencia.id;
    setModalAdvertencia({ ...modalAdvertencia, activo: false });

    try {
      await barberoDashboardService.completarCita(citaId);
      setToastExito({ activo: true, mensaje: '¡Servicio completado con éxito!' });
      cargarAgendaDelDia(barberoId, fechaFiltro);
      
      // Auto-ocultar toast
      setTimeout(() => setToastExito({ activo: false, mensaje: '' }), 3500);
    } catch (error) {
      console.error(error.message);
      alert("Error al actualizar la cita.");
    }
  };

  // Efecto para cerrar el menú si se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Efecto para detectar scroll
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n">
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">BARBER</span>
            </div>
          </div>

          <div className="user-menu-container" ref={dropdownRef}>
            <button 
              className={`user-profile-button ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="avatar-circle-n8n">
                {nombrePila ? nombrePila.charAt(0).toUpperCase() : '...'}
              </div>
              <ChevronDown size={18} className="chevron-icon" />
            </button>

            {isDropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-header">
                  <p className="dropdown-user-name">{nombrePila ? nombrePila : 'Cargando...'}</p>
                  <p className="dropdown-user-role">Barbero profesional</p>
                </div>
                
                <div className="dropdown-divider"></div>

                <button className="dropdown-item logout-btn-n8n" onClick={handleLogout}>
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/*SECCION DE BIENVENIDA*/}
      <section className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="admin-subtitle">Panel de Profesional</div>
          <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginTop: '0.5rem', marginBottom: 0 }}>
            Bienvenido{nombrePila ? `, ${nombrePila}` : '...'}
          </h1>
          <p className="welcome-text" style={{ whiteSpace: 'nowrap', marginTop: '0.5rem', marginBottom: 0 }}>
            Aquí tienes tu agenda y métricas para hoy.
          </p>
        </div>
        
        {/* Contenedor derecho: Fecha + Input Date */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', paddingBottom: '0.5rem' }}>
          <div style={{ color: '#374151', fontWeight: 700 }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).split(',').map(s => s.trim().charAt(0).toUpperCase() + s.trim().slice(1)).join(', ')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <CalendarIcon size={18} color="#6B7280" style={{ marginRight: '8px' }} />
            <input 
              type="date" 
              value={fechaFiltro} 
              onChange={(e) => setFechaFiltro(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '0.95rem', color: '#374151', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </section>

      {/* LAS 3 TARJETAS (KPIs) */}
      <section className="stats-grid">
          <div className="insight-card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#FEF3C7', borderRadius: '50%', color: '#D97706' }}><Clock size={28} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#6B7280' }}>Pendientes</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>{estadisticas.pendientes} citas</h3>
            </div>
          </div>

          <div className="insight-card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#D1FAE5', borderRadius: '50%', color: '#059669' }}><CalendarCheck size={28} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#6B7280' }}>Completados</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>{estadisticas.completados} servicios.</h3>
            </div>
          </div>

          <div className="insight-card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#E0E7FF', borderRadius: '50%', color: '#4F46E5' }}><DollarSign size={28} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#6B7280' }}>Producido Hoy</p>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>${estadisticas.ingresos.toLocaleString()}</h3>
            </div>
          </div>
      </section>

      <section className="modules-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.6rem', backgroundColor: 'rgba(176, 141, 40, 0.1)', borderRadius: '10px', color: '#B08D28', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarCheck size={24} />
          </div>
          <h2 style={{ fontSize: '1.7rem', color: '#111827', margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
            Agenda del día
          </h2>
        </div>

        <div className="table-container" style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          
          {cargandoAgenda ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>Cargando tu agenda...</div>
          ) : citasHoy.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <AlertCircle size={48} color="#D1D5DB" style={{ margin: '0 auto 1rem' }} />
              <h4 style={{ color: '#374151', margin: '0 0 0.5rem' }}>Día libre</h4>
              <p style={{ color: '#6B7280', margin: 0 }}>No tienes citas asignadas para esta fecha.</p>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#F9FAFB' }}>
                  <tr>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Hora</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Cliente</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Servicio</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Precio</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Estado</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid #E5E7EB' }}>
                  {citasHoy.map((cita) => {
                    // Normalizacion del estado para que React no se confunda con mayúsculas/minúsculas
                    const estadoText = cita.estado?.toLowerCase() || '';
                    const isPendiente = estadoText === 'pendiente';
                    const isCompletada = estadoText === 'completada' || estadoText === 'completado';

                    return (
                      <tr key={cita.id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#111827' }}>{cita.hora.slice(0, 5)}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ fontWeight: 500, color: '#111827' }}>{cita.cliente_nombre}</div>
                          <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>{cita.cliente_telefono}</div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#374151' }}>{cita.servicio || 'Servicio no especificado'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#10B981' }}>
                          ${cita.precio ? cita.precio.toLocaleString() : '0'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '9999px', 
                            fontSize: '0.8rem', 
                            fontWeight: 700, 
                            textTransform: 'uppercase', 
                            backgroundColor: isCompletada ? '#D1FAE5' : estadoText === 'cancelada' ? '#FEE2E2' : '#FEF3C7',
                            color: isCompletada ? '#065F46' : estadoText === 'cancelada' ? '#991B1B' : '#92400E'
                          }}>
                            {cita.estado ? cita.estado : 'Pendiente'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          {isPendiente ? (
                            <button 
                              onClick={() => solicitarCompletarCita(cita.id)}
                              style={{ width: '82px', padding: '0.5rem', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}
                              onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                              onMouseOut={(e) => e.target.style.backgroundColor = '#10B981'}
                              title="Marcar como completado"
                            >
                              <CheckCircle size={20} />
                            </button>
                          ) : (
                            <span style={{ 
                              color: '#9CA3AF', 
                              fontSize: '0.85rem', 
                              fontWeight: 700, 
                              textTransform: 'uppercase' 
                            }}>
                              Finalizado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ESTILOS DE ANIMACIÓN */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -100px); opacity: 0; }
          to   { transform: translate(-50%, 0);      opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* MODAL DE ADVERTENCIA (UI AMARILLO SOBRIO) */}
      {modalAdvertencia.activo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '2.5rem 2rem', width: '90%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ backgroundColor: '#FEF3C7', width: '70px', height: '70px', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle color="#F59E0B" size={34} />
            </div>
            <h3 style={{ margin: '0 0 1rem', color: '#111827', fontSize: '1.35rem', fontWeight: 600 }}>{modalAdvertencia.titulo}</h3>
            <p style={{ margin: '0 0 2rem', color: '#6B7280', fontSize: '1rem', lineHeight: 1.5 }}>{modalAdvertencia.mensaje}</p>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setModalAdvertencia({ activo: false, id: null, titulo: '', mensaje: '' })}
                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                Volver
              </button>
              <button 
                onClick={confirmarFinalizacion}
                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#F59E0B', color: '#fff', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(245,158,11,0.2)' }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#D97706'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#F59E0B'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE ÉXITO (VERDE) */}
      {toastExito.activo && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: '90%', maxWidth: '420px', animation: 'slideDown 0.5s ease-out' }}>
          <div style={{ backgroundColor: '#ECFDF5', borderLeft: '5px solid #10B981', padding: '1.2rem 1.5rem', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#10B981', borderRadius: '50%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle color="white" size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#065F46', fontSize: '1rem', fontWeight: 700 }}>¡Actualizado!</h4>
              <p style={{ margin: '4px 0 0 0', color: '#047857', fontSize: '0.85rem' }}>{toastExito.mensaje}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberoDashboard;