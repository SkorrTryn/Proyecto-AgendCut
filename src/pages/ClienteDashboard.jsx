import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, CalendarPlus, Users, Clock, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase/client';
import { serviciosService } from '../services/serviciosService';
import logoAgendcut from '../assets/Logo.svg';
import emailjs from '@emailjs/browser';

const ClienteDashboard = () => {
  const navigate = useNavigate();
  const [nombreCliente, setNombreCliente] = useState(null);
  
  // Sistema de navegación (tabs)
  const [vistaActiva, setVistaActiva] = useState('agendar');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const contentSectionRef = useRef(null);

  // Estados para ocultar header al hacer scroll
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Estados para el módulo de barberos
  const [barberos, setBarberos] = useState([]);
  const [cargandoBarberos, setCargandoBarberos] = useState(false);
  const [fotoModal, setFotoModal] = useState(null);

  // Estados para agendar cita
  const [paso, setPaso] = useState(1);
  // Cita guarda un array de servicios []
  const [cita, setCita] = useState({ servicios: [], barbero: '', fecha: '', hora: '' });
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(false);

  // Lógica de selección múltiple
  const toggleServicio = (servicio) => {
    const existe = cita.servicios.find(item => item.id === servicio.id);
    if (existe) {
      setCita({ ...cita, servicios: cita.servicios.filter(item => item.id !== servicio.id) });
    } else {
      setCita({ ...cita, servicios: [...cita.servicios, servicio] });
    }
  };

  const calcularTotalCita = () => {
    return cita.servicios.reduce((total, s) => total + (s.precio || 0), 0);
  };

  // Estados para conflictos de horario
  const [conflictoHorario, setConflictoHorario] = useState(false);
  const [verificandoHora, setVerificandoHora] = useState(false);
  const [guardandoCita, setGuardandoCita] = useState(false);
  const [mostrarExito, setMostrarExito] = useState(false);

  // Función para guardar la cita
  const confirmarYGuardarCita = async () => {
    setGuardandoCita(true);
    try {
      // 1. Obtener sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Sesión expirada");
        return;
      }

      let nombreClienteEmail = session.user.email;
      let telefonoClienteDB = 'No registrado';

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone') 
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        nombreClienteEmail = profile.full_name || nombreClienteEmail;
        telefonoClienteDB = profile.phone || telefonoClienteDB;
      }

      const totalPrecio = calcularTotalCita();
      // Arreglo de strings para columnas tipo text[] en PostgreSQL
      const serviciosArray = cita.servicios.map(s => s.nombre);

      // Inserción con formato de Array 
      const { error } = await supabase
        .from('citas')
        .insert([{
          cliente_nombre:   nombreClienteEmail,
          cliente_telefono: telefonoClienteDB,
          servicio:         serviciosArray, // [ "Servicio 1", "Servicio 2" ]
          fecha:            cita.fecha,
          hora:             cita.hora,
          estado:           'Pendiente',
          precio:           totalPrecio,
          barbero_id:       cita.barbero
        }]);

      if (error) {
        console.error("Error detallado de Supabase:", error);
        alert(`Error en la base de datos: ${error.message}`);
        return;
      }

      // Envío de correo de confirmación con emailjs
      try {
        const barberoElegido = barberos.find(b => b.id === cita.barbero);
        const nombreBarbero = barberoElegido ? barberoElegido.nombre : 'Profesional asignado';

        const templateParams = {
          from_name: nombreClienteEmail, 
          from_email: session.user.email, 
          servicio: serviciosArray.join(', '),
          especialista: nombreBarbero,
          fecha: cita.fecha,
          hora: cita.hora,
          precio: "$" + totalPrecio.toLocaleString(),
          message: "Reserva confirmada vía web"
        };

        await emailjs.send(
          'service_e4ceu6p', 
          'template_u2moi8l', 
          templateParams, 
          'DMDJiiTvY1NCQPEWC'
        );
        console.log("Correo de confirmación enviado exitosamente.");
      } catch (emailError) {
        console.error("Error al enviar el correo con EmailJS:", emailError);
        // En caso de error de correo, se da continuidad para no interrumpir el flujo de reserva
      }

      // Éxito: activamos la tarjeta visual en vez de alert()
      setMostrarExito(true);
      setCita({ servicios: [], barbero: '', fecha: '', hora: '' });

      
      setTimeout(() => {
        setMostrarExito(false);
        setPaso(1);
        cambiarVista('mis-citas');
      }, 3500); //3.5 segundos para que el usuario lea el mensaje y luego se redirige a "Mis citas"

    } catch (error) {
      console.error("Error inesperado:", error);
    } finally {
      setGuardandoCita(false);
    }
  };

  // Estados para mis citas
  const [misCitas, setMisCitas] = useState([]);
  const [cargandoCitas, setCargandoCitas] = useState(false);

  // Estados de modales y alarmas frontend
  const [modalAdvertencia, setModalAdvertencia] = useState({ activo: false, tipo: '', id: null, titulo: '', mensaje: '' });
  const [toastAdvertencia, setToastAdvertencia] = useState({ activo: false, mensaje: '' });

  // Cargar las citas del cliente
  const obtenerMisCitas = async () => {
    setCargandoCitas(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Conseguir el nombre real del cliente actual (o su correo como fallback, si antes se registró así)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      const nombreBusqueda = profile?.full_name || session.user.email;

      const { data, error } = await supabase
        .from('citas')
        .select('*')
        .eq('cliente_nombre', nombreBusqueda) // Buscar por su nombre real o correo
        .order('fecha', { ascending: false });

      if (error) throw error;
      setMisCitas(data || []);
    } catch (error) {
      console.error("Error al obtener citas:", error);
    } finally {
      setCargandoCitas(false);
    }
  };

  // Ejecutar al cambiar a la vista 'mis-citas'
  useEffect(() => {
    if (vistaActiva === 'mis-citas') {
      obtenerMisCitas();
    }
  }, [vistaActiva]);

  // Acciones de citas (activan el modal)
  const solicitarCancelarCita = (id) => {
    setModalAdvertencia({
      activo: true,
      tipo: 'cancelar',
      id: id,
      titulo: '¿Cancelar esta reserva?',
      mensaje: 'Esta acción liberará el horario para otros clientes y no podrás recuperarlo.'
    });
  };

  const solicitarEliminarHistorial = (id) => {
    setModalAdvertencia({
      activo: true,
      tipo: 'eliminar',
      id: id,
      titulo: '¿Borrar del historial?',
      mensaje: 'Esta notificación desaparecerá visualmente de tu panel de manera permanente.'
    });
  };

  // Confirmar acción del modal
  const confirmarAccionModal = async () => {
    const { tipo, id } = modalAdvertencia;
    setModalAdvertencia({ ...modalAdvertencia, activo: false }); // Cierre de modal

    try {
      if (tipo === 'cancelar') {
        const { error } = await supabase.from('citas').update({ estado: 'Cancelada' }).eq('id', id);
        if (error) throw error;
        setToastAdvertencia({ activo: true, mensaje: 'Cita cancelada correctamente.' });
        obtenerMisCitas(); 
      } else if (tipo === 'eliminar') {
        const { error } = await supabase.from('citas').delete().eq('id', id);
        if (error) throw error;
        setToastAdvertencia({ activo: true, mensaje: 'Notificación eliminada permanentemente.' });
        setMisCitas(misCitas.filter(c => c.id !== id));
      }

      // Cerrar la notificación sola
      setTimeout(() => setToastAdvertencia({ activo: false, mensaje: '' }), 3500);
    } catch (error) {
      console.error(error);
      alert(`Error al procesar la acción.`);
    }
  };

  // Verificador en tiempo real (anti-cruces de horario)
  useEffect(() => {
    const chequearDisponibilidad = async () => {
      if (cita.fecha && cita.hora && cita.barbero) {
        setVerificandoHora(true);
        setConflictoHorario(false);
        try {
          // Extracción de TODAS las citas de ese barbero para ese día
          const { data, error } = await supabase
            .from('citas')
            .select('id, hora')
            .eq('barbero_id', cita.barbero)
            .eq('fecha', cita.fecha)
            .neq('estado', 'cancelada');

          if (error) throw error;

          if (data && data.length > 0) {
            // Duración total de los servicios seleccionados (mínimo 30 min si no hay dato)
            const duracionNuevaCita = cita.servicios.reduce(
              (total, s) => total + (s.duracion_minutos || 30), 0
            );

            // Converción de la hora elegida a minutos desde medianoche
            const [horaNueva, minNuevo] = cita.hora.split(':').map(Number);
            const inicioNuevo = horaNueva * 60 + minNuevo;
            const finNuevo = inicioNuevo + duracionNuevaCita;

            let hayCruce = false;

            // Cmparación de con cada cita existente usando la fórmula de solapamiento
            for (let citaExistente of data) {
              const [horaEx, minEx] = citaExistente.hora.split(':').map(Number);
              const inicioExistente = horaEx * 60 + minEx;
              const finExistente = inicioExistente + 40;// Asunción de 40 min promedio para la cita existente
              if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
                hayCruce = true;
                break;
              }
            }

            setConflictoHorario(hayCruce);
          }
        } catch (err) {
          console.error("Error verificando disponibilidad:", err);
        } finally {
          setVerificandoHora(false);
        }
      } else {
        setConflictoHorario(false);
      }
    };

    chequearDisponibilidad();
  }, [cita.fecha, cita.hora, cita.barbero, cita.servicios]);

  useEffect(() => {
    const cargarPerfil = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();

        const nombreRecuperado = profile?.full_name || session.user.user_metadata?.full_name;

        if (nombreRecuperado) {
          setNombreCliente(nombreRecuperado.split(' ')[0]);
        } else {
          // Opcion B: Si por alguna extraña razón no hay nombre en absoluto, no explota, uso de el correo
          setNombreCliente(session.user.email.split('@')[0]);
        }
      } catch (error) {
        console.error("Error cargando el perfil:", error);
        setNombreCliente('Cliente');
      }
    };

    cargarPerfil();
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Función para cambiar de vista y hacer scroll automático (sobre todo en móvil)
  const cambiarVista = (nuevaVista) => {
    setVistaActiva(nuevaVista);
    
    // Si estamos en móvil o el ancho es pequeño, ejecución de scroll suave hacia abajo
    if (window.innerWidth < 800 && contentSectionRef.current) {
      setTimeout(() => {
        contentSectionRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  };

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

  // Cargar barberos 
  useEffect(() => {
    if ((vistaActiva === 'barberos' || vistaActiva === 'agendar') && barberos.length === 0) {
      const cargarBarberos = async () => {
        setCargandoBarberos(true);
        try {
          const { data, error } = await supabase
            .from('barberos')
            .select('id, nombre, telefono, email, foto_url, servicios_especialidad');
          
          if (error) throw error;
          if (data) setBarberos(data);
        } catch (err) {
          console.error("Error cargando barberos:", err);
        } finally {
          setCargandoBarberos(false);
        }
      };
      cargarBarberos();
    }
  }, [vistaActiva, barberos.length]);

  // Cargar servicios
  useEffect(() => {
    if (vistaActiva === 'agendar' && servicios.length === 0) {
      const cargarServicios = async () => {
        setCargandoServicios(true);
        try {
          const data = await serviciosService.obtenerServiciosActivos();
          if (data) setServicios(data);
        } catch (err) {
          console.error("Error cargando servicios:", err);
        } finally {
          setCargandoServicios(false);
        }
      };
      cargarServicios();
    }
  }, [vistaActiva, servicios.length]);

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n">
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">CLIENTE</span>
            </div>
          </div>

          <div className="user-menu-container" ref={dropdownRef}>
            <button className={`user-profile-button ${isDropdownOpen ? 'active' : ''}`} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <div className="avatar-circle-n8n">
                {nombreCliente ? nombreCliente.charAt(0).toUpperCase() : 'C'}
              </div>
              <ChevronDown size={18} className="chevron-icon" />
            </button>

            {isDropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-header">
                  <p className="dropdown-user-name">{nombreCliente || 'Cargando...'}</p>
                  <p className="dropdown-user-role">Cliente VIP</p>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item logout-btn-n8n" onClick={handleLogout}>
                  <LogOut size={18} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <section className="welcome-section" style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          Hola{nombreCliente ? `, ${nombreCliente}` : '...'}
        </h1>
        <p style={{ color: '#6B7280', fontSize: '1.1rem' }}>¿Qué te gustaría hacer hoy?</p>
      </section>

    
      <section className="modules-section">
        <div className="modules-grid-premium">
          
          {/* MÓDULO 1: NUEVA CITA */}
          <div 
            onClick={() => cambiarVista('agendar')}
            className="card-modulo-premium"
            style={{ 
              backgroundColor: vistaActiva === 'agendar' ? '#FFFBEB' : '#fff', 
              borderRadius: '16px', 
              padding: '2rem 1.5rem', 
              cursor: 'pointer', 
              boxShadow: vistaActiva === 'agendar' ? '0 10px 15px -3px rgba(176,141,40,0.1)' : '0 4px 6px rgba(0,0,0,0.05)', 
              border: vistaActiva === 'agendar' ? '2px solid #B08D28' : '2px solid transparent',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              transform: vistaActiva === 'agendar' ? 'translateY(-4px)' : 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Marca de agua sutil */}
            <CalendarPlus 
              size={200} 
              style={{ 
                position: 'absolute', 
                bottom: '-60px', 
                right: '-40px', 
                opacity: 0.04, 
                color: '#111827', 
                transform: 'rotate(-15deg)',
                pointerEvents: 'none'
              }} 
            />
            <div style={{ backgroundColor: vistaActiva === 'agendar' ? '#B08D28' : '#FEF3C7', padding: '1rem', borderRadius: '12px', color: vistaActiva === 'agendar' ? '#fff' : '#B08D28', marginBottom: '1.5rem', transition: 'all 0.3s' }}>
              <CalendarPlus size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', fontWeight: 700, color: '#111827' }}>
              Agendar cita
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.5 }}>
              Reserva tu próximo corte eligiendo la fecha, el barbero y tu servicio ideal.
            </p>
          </div>

          {/* MÓDULO 2: MIS CITAS */}
          <div 
            onClick={() => cambiarVista('mis-citas')}
            className="card-modulo-premium"
            style={{ 
              backgroundColor: vistaActiva === 'mis-citas' ? '#FFFBEB' : '#fff', 
              borderRadius: '16px', 
              padding: '2rem 1.5rem', 
              cursor: 'pointer', 
              boxShadow: vistaActiva === 'mis-citas' ? '0 10px 15px -3px rgba(176,141,40,0.1)' : '0 4px 6px rgba(0,0,0,0.05)', 
              border: vistaActiva === 'mis-citas' ? '2px solid #B08D28' : '2px solid transparent',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              transform: vistaActiva === 'mis-citas' ? 'translateY(-4px)' : 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Marca de agua sutil */}
            <Clock 
              size={200} 
              style={{ 
                position: 'absolute', 
                bottom: '-60px', 
                right: '-40px', 
                opacity: 0.04, 
                color: '#111827', 
                transform: 'rotate(-15deg)',
                pointerEvents: 'none'
              }} 
            />
            <div style={{ backgroundColor: vistaActiva === 'mis-citas' ? '#B08D28' : '#FEF3C7', padding: '1rem', borderRadius: '12px', color: vistaActiva === 'mis-citas' ? '#fff' : '#B08D28', marginBottom: '1.5rem', transition: 'all 0.3s' }}>
              <Clock size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', fontWeight: 700, color: '#111827' }}>
              Mis citas
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.5 }}>
              Revisa tu historial, verifica tus próximas reservas o cancela si es necesario.
            </p>
          </div>

          {/* MÓDULO 3: NUESTROS BARBEROS */}
          <div 
            onClick={() => cambiarVista('barberos')}
            className="card-modulo-premium"
            style={{ 
              backgroundColor: vistaActiva === 'barberos' ? '#FFFBEB' : '#fff', 
              borderRadius: '16px', 
              padding: '2rem 1.5rem', 
              cursor: 'pointer', 
              boxShadow: vistaActiva === 'barberos' ? '0 10px 15px -3px rgba(176,141,40,0.1)' : '0 4px 6px rgba(0,0,0,0.05)', 
              border: vistaActiva === 'barberos' ? '2px solid #B08D28' : '2px solid transparent',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              transform: vistaActiva === 'barberos' ? 'translateY(-4px)' : 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Marca de agua sutil */}
            <Users 
              size={200} 
              style={{ 
                position: 'absolute', 
                bottom: '-60px', 
                right: '-40px', 
                opacity: 0.04, 
                color: '#111827', 
                transform: 'rotate(-15deg)',
                pointerEvents: 'none'
              }} 
            />
            <div style={{ backgroundColor: vistaActiva === 'barberos' ? '#B08D28' : '#FEF3C7', padding: '1rem', borderRadius: '12px', color: vistaActiva === 'barberos' ? '#fff' : '#B08D28', marginBottom: '1.5rem', transition: 'all 0.3s' }}>
              <Users size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', fontWeight: 700, color: '#111827' }}>
              El equipo
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.5 }}>
              Conoce a nuestros profesionales, sus especialidades y elige a tu favorito.
            </p>
          </div>

        </div>

        {/* Secciones */}
        <div ref={contentSectionRef} style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          
          {vistaActiva === 'agendar' && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

              {/* INDICADOR DE PASOS */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', gap: '1rem' }}>
                {[1, 2, 3].map((num) => (
                  <div key={num} style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: paso >= num ? '#B08D28' : '#E5E7EB',
                    color: paso >= num ? '#fff' : '#9CA3AF',
                    fontWeight: 'bold', transition: 'all 0.3s',
                    fontFamily: "'Open Sans', sans-serif"
                  }}>
                    {num}
                  </div>
                ))}
              </div>

              {/* PASO 1: SELECCIÓN DE SERVICIO (MÚLTIPLE) */}
              {paso === 1 && (
                <div style={{ width: '100%' }}>
                  <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontFamily: "'Open Sans', sans-serif" }}>Selecciona tus servicios</h2>
                  <p style={{ textAlign: 'center', color: '#6B7280', marginBottom: '2rem', fontSize: '0.95rem', fontFamily: "'Open Sans', sans-serif" }}>Puedes elegir uno o varios</p>
                  
                  {cargandoServicios ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Cargando servicios disponibles...</div>
                  ) : servicios.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>No hay servicios disponibles en este momento.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {servicios.map((s) => {
                          const seleccionado = cita.servicios.some(item => item.id === s.id);
                          return (
                            <div 
                              key={s.id}
                              onClick={() => toggleServicio(s)}
                              style={{ 
                                padding: '1.5rem',
                                border: seleccionado ? '2px solid #B08D28' : '2px solid transparent',
                                borderRadius: '16px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                cursor: 'pointer', transition: 'all 0.3s',
                                backgroundColor: seleccionado ? '#FFFBEB' : '#F9FAFB',
                                boxShadow: seleccionado ? '0 4px 12px rgba(176,141,40,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                                transform: seleccionado ? 'translateY(-2px)' : 'none',
                                position: 'relative'
                              }}
                              onMouseOver={(e) => { if (!seleccionado) { e.currentTarget.style.borderColor = '#B08D28'; e.currentTarget.style.backgroundColor = '#FFFBEB'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                              onMouseOut={(e) => { if (!seleccionado) { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.transform = 'translateY(0)'; } }}
                            >
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.15rem', fontFamily: "'Open Sans', sans-serif", fontWeight: 700, color: '#111827' }}>{s.nombre}</h4>
                                <span style={{ color: '#6B7280', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.4rem', fontFamily: "'Open Sans', sans-serif" }}>
                                  <Clock size={14} /> {s.duracion_minutos} min
                                </span>
                              </div>
                              <div style={{ fontWeight: 600, color: '#B08D28', fontSize: '1.3rem', fontFamily: "'Open Sans', sans-serif" }}>${s.precio.toLocaleString()}</div>

                              {/* Chulito de seleccionado */}
                              {seleccionado && (
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', backgroundColor: '#B08D28', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', fontSize: '0.9rem' }}>
                                  ✓
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Botón para avanzar */}
                      <button
                        disabled={cita.servicios.length === 0}
                        onClick={() => setPaso(2)}
                        style={{
                          width: '100%', padding: '1.2rem',
                          backgroundColor: cita.servicios.length > 0 ? '#111827' : '#E5E7EB',
                          color: cita.servicios.length > 0 ? '#fff' : '#9CA3AF',
                          borderRadius: '12px', border: 'none', fontWeight: 600,
                          cursor: cita.servicios.length > 0 ? 'pointer' : 'not-allowed',
                          fontSize: '1.1rem', transition: 'all 0.3s',
                          boxShadow: cita.servicios.length > 0 ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                          fontFamily: "'Open Sans', sans-serif"
                        }}
                      >
                        Continuar servicios ({cita.servicios.length})
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* PASO 2: BARBERO, FECHA Y HORA */}
              {paso === 2 && (
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
                    <button 
                      onClick={() => setPaso(1)} 
                      title="Volver a servicios"
                      style={{ 
                        background: '#F3F4F6', border: 'none', color: '#B08D28', 
                        cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#E5E7EB'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </div>
                  <h2 style={{ marginBottom: '2.5rem', fontFamily: "'Open Sans', sans-serif", textAlign: 'center' }}>¿Con quién y cuándo?</h2>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

                    {/* 1. Barbero */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontFamily: "'Open Sans', sans-serif", color: '#374151' }}>Especialista</label>
                      <select
                        value={cita.barbero}
                        onChange={(e) => setCita({...cita, barbero: e.target.value})}
                        style={{ width: '100%', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F9FAFB', outline: 'none', transition: 'border-color 0.2s', fontSize: '1rem', cursor: 'pointer' }}
                        onFocus={(e) => e.target.style.borderColor = '#B08D28'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      >
                        <option value="">-- Seleccionar --</option>
                        {barberos.map(b => (
                          <option key={b.id} value={b.id}>{b.nombre.split(' ')[0]}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Fecha */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontFamily: "'Open Sans', sans-serif", color: '#374151' }}>Elige el día</label>
                      <input
                        type="date"
                        value={cita.fecha}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setCita({...cita, fecha: e.target.value})}
                        style={{ width: '100%', padding: '1.2rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F9FAFB', outline: 'none', transition: 'border-color 0.2s', fontSize: '1rem', cursor: 'pointer' }}
                        onFocus={(e) => e.target.style.borderColor = '#B08D28'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>

                    {/* 3. Hora */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontFamily: "'Open Sans', sans-serif", color: '#374151' }}>Hora de inicio</label>
                      <input
                        type="time"
                        value={cita.hora}
                        onChange={(e) => setCita({...cita, hora: e.target.value})}
                        style={{ width: '100%', padding: '1.2rem', borderRadius: '12px', border: conflictoHorario ? '2px solid #EF4444' : '1px solid #E5E7EB', fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F9FAFB', outline: 'none', transition: 'border-color 0.2s', fontSize: '1rem', cursor: 'pointer' }}
                        onFocus={(e) => { if (!conflictoHorario) e.target.style.borderColor = '#B08D28'; }}
                        onBlur={(e) => { if (!conflictoHorario) e.target.style.borderColor = '#E5E7EB'; }}
                      />
                    </div>
                  </div>

                  {/* TARJETA DE ADVERTENCIA DE CRUCE */}
                  {conflictoHorario && (
                    <div style={{ backgroundColor: '#FEF2F2', borderLeft: '4px solid #EF4444', padding: '1.2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                      <AlertCircle color="#EF4444" size={24} style={{ flexShrink: 0 }} />
                      <span style={{ color: '#991B1B', fontWeight: 600, fontFamily: "'Open Sans', sans-serif", fontSize: '0.95rem' }}>
                        ¡Ups! El profesional ya tiene una cita reservada a esta hora. Por favor, selecciona otro horario.
                      </span>
                    </div>
                  )}

                  {/* Botón: exige barbero + fecha + hora + sin conflicto */}
                  <button
                    disabled={!cita.fecha || !cita.barbero || !cita.hora || conflictoHorario || verificandoHora}
                    onClick={() => setPaso(3)}
                    style={{
                      width: '100%', padding: '1.2rem',
                      backgroundColor: (cita.fecha && cita.barbero && cita.hora && !conflictoHorario) ? '#111827' : '#E5E7EB',
                      color: (cita.fecha && cita.barbero && cita.hora && !conflictoHorario) ? '#fff' : '#9CA3AF',
                      borderRadius: '12px', border: 'none', fontWeight: 600,
                      cursor: (cita.fecha && cita.barbero && cita.hora && !conflictoHorario) ? 'pointer' : 'not-allowed',
                      fontSize: '1.1rem', transition: 'all 0.3s',
                      boxShadow: (cita.fecha && cita.barbero && cita.hora && !conflictoHorario) ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                      fontFamily: "'Open Sans', sans-serif"
                    }}
                  >
                    {verificandoHora ? 'Verificando horario...' : 'Continuar al resumen'}
                  </button>
                </div>
              )}

              {/* PASO 3: CONFIRMACIÓN FINAL */}
              {paso === 3 && (
                <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
                    <button 
                      onClick={() => setPaso(2)} 
                      title="Volver a fecha y barbero"
                      style={{ 
                        background: '#F3F4F6', border: 'none', color: '#B08D28', 
                        cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#E5E7EB'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </div>
                  <h2 style={{ marginBottom: '1.5rem', fontFamily: "'Open Sans', sans-serif" }}>Resumen de tu reserva</h2>

                  <div style={{ backgroundColor: '#FFFBEB', padding: '3rem', borderRadius: '20px', border: '2px dashed #B08D28', marginBottom: '2.5rem', textAlign: 'center', boxShadow: '0 4px 15px rgba(176,141,40,0.1)' }}>

                    {/* Lista dinámica de servicios seleccionados */}
                    <h4 style={{ margin: '0 0 1rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem', fontFamily: "'Open Sans', sans-serif" }}>Servicios seleccionados</h4>
                    <div style={{ marginBottom: '1.5rem' }}>
                      {cita.servicios.map((s, idx) => (
                        <p key={idx} style={{ margin: '0 0 0.5rem', color: '#111827', fontSize: '1.2rem', fontWeight: 600, fontFamily: "'Open Sans', sans-serif" }}>
                          {s.nombre} <span style={{ color: '#B08D28', fontWeight: 600, fontFamily: "'Open Sans', sans-serif" }}>(${s.precio.toLocaleString()})</span>
                        </p>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', color: '#6B7280', fontSize: '0.9rem', marginBottom: '0.4rem', fontFamily: "'Open Sans', sans-serif" }}>Profesional</span>
                        <strong style={{ color: '#111827', fontFamily: "'Open Sans', sans-serif", fontSize: '1.1rem' }}>{barberos.find(b => b.id == cita.barbero)?.nombre?.split(' ')[0]}</strong>
                      </div>
                      <div style={{ width: '1px', backgroundColor: 'rgba(176,141,40,0.3)' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', color: '#6B7280', fontSize: '0.9rem', marginBottom: '0.4rem', fontFamily: "'Open Sans', sans-serif" }}>Fecha</span>
                        <strong style={{ color: '#111827', fontFamily: "'Open Sans', sans-serif", fontSize: '1.1rem' }}>{cita.fecha}</strong>
                      </div>
                      <div style={{ width: '1px', backgroundColor: 'rgba(176,141,40,0.3)' }}></div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', color: '#6B7280', fontSize: '0.9rem', marginBottom: '0.4rem', fontFamily: "'Open Sans', sans-serif" }}>Hora</span>
                        <strong style={{ color: '#111827', fontFamily: "'Open Sans', sans-serif", fontSize: '1.1rem' }}>{cita.hora}</strong>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(176,141,40,0.2)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                      <span style={{ color: '#6B7280', fontSize: '0.95rem', fontFamily: "'Open Sans', sans-serif" }}>Total estimado</span>
                      <p style={{ fontSize: '2.4rem', color: '#B08D28', fontWeight: 900, margin: '0.5rem 0 0', fontFamily: "'Open Sans', sans-serif", letterSpacing: '-1px' }}>
                        ${calcularTotalCita().toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={guardandoCita}
                    onClick={confirmarYGuardarCita}
                    style={{ width: '100%', padding: '1.2rem', backgroundColor: '#B08D28', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '1.1rem', cursor: guardandoCita ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(176,141,40,0.3)', transition: 'transform 0.2s', opacity: guardandoCita ? 0.7 : 1, fontFamily: "'Open Sans', sans-serif" }}
                    onMouseOver={(e) => { if (!guardandoCita) e.target.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}
                  >
                    {guardandoCita ? 'Guardando cita...' : 'Confirmar y reservar'}
                  </button>
                </div>
              )}

            </div>
          )}

          {vistaActiva === 'mis-citas' && (
            <div style={{ padding: '1rem', animation: 'fadeIn 0.5s ease' }}>
              <h2 style={{ color: '#111827', marginBottom: '1.5rem', fontFamily: "'Open Sans', sans-serif" }}>
                Historial de Citas
              </h2>

              {cargandoCitas ? (
                <p style={{ color: '#9CA3AF' }}>Cargando tus citas...</p>
              ) : misCitas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#F9FAFB', borderRadius: '15px' }}>
                  <p style={{ color: '#6B7280', marginBottom: '1rem' }}>Aún no tienes citas agendadas.</p>
                  <button onClick={() => cambiarVista('agendar')} style={{ color: '#B08D28', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600, fontFamily: "'Open Sans', sans-serif" }}>
                    ¡Agenda tu primera cita aquí!
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.2rem' }}>
                  {misCitas.map((c) => (
                    <div key={c.id} style={{
                      backgroundColor: '#fff',
                      borderRadius: '16px',
                      padding: '1.5rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      border: '1px solid #E5E7EB', // Borde notorio en lugar del borde izquierdo invisible
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between' /* Asegura que los botones empujen al fondo */
                    }}>
                      <div>
                        {/* ENCABEZADO DE LA TARJETA */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold', 
                            padding: '6px 10px', 
                            borderRadius: '8px',
                            backgroundColor: c.estado === 'Cancelada' ? '#FEF2F2' : c.estado === 'Pendiente' ? '#FFFBEB' : '#ECFDF5',
                            color: c.estado === 'Cancelada' ? '#EF4444' : c.estado === 'Pendiente' ? '#F59E0B' : '#10B981',
                            fontFamily: "'Open Sans', sans-serif"
                          }}>
                            {c.estado.toUpperCase()}
                          </span>
                          <span style={{ color: '#6B7280', fontSize: '0.85rem', fontFamily: "'Open Sans', sans-serif", fontWeight: 600 }}>{c.fecha} - {c.hora}</span>
                        </div>

                        {/* CUERPO DE LA TARJETA */}
                        <h3 style={{ color: '#111827', margin: '0 0 8px 0', fontSize: '1.15rem', fontFamily: "'Open Sans', sans-serif", lineHeight: 1.4 }}>
                          {Array.isArray(c.servicio) ? c.servicio.join(', ') : c.servicio}
                        </h3>
                        <p style={{ color: '#B08D28', fontWeight: 800, margin: '0', fontSize: '1.1rem', fontFamily: "'Open Sans', sans-serif" }}>
                          ${c.precio?.toLocaleString()}
                        </p>
                      </div>

                      {/* BOTONERA RESPONSIVE (COLORES OPACOS Y GRIS) */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                        {c.estado?.toLowerCase() === 'pendiente' && (
                          <button 
                            onClick={() => solicitarCancelarCita(c.id)}
                            className="btn-cita-responsivo"
                            style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: 'rgba(239, 68, 68, 0.85)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(239,68,68,0.2)' }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.85)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            Cancelar Cita
                          </button>
                        )}
                        <button 
                          onClick={() => solicitarEliminarHistorial(c.id)}
                          className="btn-cita-responsivo"
                          style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#6B7280', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(107,114,128,0.2)' }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#4B5563'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#6B7280'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          Borrar Notificación
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {vistaActiva === 'barberos' && (
            <div style={{ position: 'relative' }}>
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#111827' }}>Conoce a los expertos</h2>
              
              {cargandoBarberos ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Cargando nuestro equipo de profesionales...</div>
              ) : barberos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6B7280' }}>Aún no hay profesionales registrados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {barberos.map(barbero => {
                    const listaServicios = barbero.servicios_especialidad 
                      ? (Array.isArray(barbero.servicios_especialidad) 
                          ? barbero.servicios_especialidad 
                          : barbero.servicios_especialidad.split(',')) 
                      : ['Corte Profesional'];

                    return (
                      <div key={barbero.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#fff', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        
                        {/* FOTO DEL BARBERO (Clickeable) */}
                        <div 
                          onClick={() => { if(barbero.foto_url) setFotoModal(barbero.foto_url) }}
                          style={{ 
                            width: '130px', height: '130px', flexShrink: 0, borderRadius: '16px', 
                            backgroundColor: '#111827', 
                            backgroundImage: barbero.foto_url ? `url(${barbero.foto_url})` : 'none',
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            cursor: barbero.foto_url ? 'zoom-in' : 'default',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'transform 0.2s'
                          }}
                        >
                          {!barbero.foto_url && (
                            <span style={{ fontSize: '3.5rem', color: '#B08D28', fontWeight: 'bold' }}>
                              {barbero.nombre.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        {/* INFORMACIÓN Y ETIQUETAS */}
                        <div style={{ flex: '1 1 300px' }}>
                          <h3 style={{ margin: '0 0 0.25rem', color: '#111827', fontSize: '1.4rem', fontWeight: 700, fontFamily: "'Open Sans', sans-serif", letterSpacing: '-0.5px' }}>{barbero.nombre}</h3>
                          <p style={{ margin: '0 0 1rem', color: '#6B7280', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {barbero.email && <span>{barbero.email}</span>}
                            {barbero.email && barbero.telefono && <span>•</span>}
                            {barbero.telefono && <span>{barbero.telefono}</span>}
                            {!barbero.email && !barbero.telefono && <span>Profesional en AgendCut</span>}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {listaServicios.map((servicio, idx) => (
                              <span key={idx} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#FEF3C7', color: '#B08D28', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, fontFamily: "'Open Sans', sans-serif" }}>
                                {servicio.trim()}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODAL DE FOTO */}
              {fotoModal && (
                <div 
                  onClick={() => setFotoModal(null)}
                  style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(5px)' }}
                >
                  <img src={fotoModal} alt="Foto del profesional" style={{ maxWidth: '90%', maxHeight: '90vh', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} />
                  <p style={{ position: 'absolute', bottom: '2rem', color: 'white', fontWeight: 500, backgroundColor: 'rgba(0,0,0,0.5)', padding: '0.5rem 1.5rem', borderRadius: '20px' }}>Haz clic en cualquier parte para cerrar</p>
                </div>
              )}

            </div>
          )}

        </div>
      </section>

      {/* TARJETA DE ÉXITO RESPONSIVE */}
      {mostrarExito && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '90%',
          maxWidth: '400px',
          animation: 'slideDown 0.5s ease-out'
        }}>
          <div style={{
            backgroundColor: '#ECFDF5', 
            borderLeft: '5px solid #10B981', 
            padding: '1.2rem',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              backgroundColor: '#10B981',
              borderRadius: '50%',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarPlus color="white" size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#065F46', fontSize: '1rem', fontWeight: '700', fontFamily: "'Open Sans', sans-serif" }}>
                ¡Reserva Exitosa!
              </h4>
              <p style={{ margin: '4px 0 0 0', color: '#047857', fontSize: '0.85rem', fontFamily: "'Open Sans', sans-serif" }}>
                Tu cita ha sido agendada. Estamos preparando todo para recibirte, te notificaremos por correo electrónico.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe de la animación del toast y opacidad */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -100px); opacity: 0; }
          to   { transform: translate(-50%, 0);      opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .btn-cita-responsivo {
          flex: 1 1 100%;
        }
        @media (min-width: 600px) {
          .btn-cita-responsivo {
            flex: 0 1 auto;
            min-width: 160px;
          }
        }
        
        .modules-grid-premium {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        @media (max-width: 768px) {
          .modules-grid-premium {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            gap: 1rem;
            padding: 0.5rem 0.5rem 1.5rem;
            margin: 0 -1.5rem;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            -webkit-overflow-scrolling: touch;
          }
          .modules-grid-premium::-webkit-scrollbar {
            display: none;
          }
          .card-modulo-premium {
            flex: 0 0 85%;
            scroll-snap-align: center;
          }
        }
      `}</style>

      {/* MODAL DE ADVERTENCIA (UI AMARILLO SOBRIO PARA CANCELAR) */}
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
                onClick={() => setModalAdvertencia({ activo: false, tipo: '', id: null, titulo: '', mensaje: '' })}
                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #E5E7EB', backgroundColor: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                Volver
              </button>
              <button 
                onClick={confirmarAccionModal}
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

      {/* TOAST DE ADVERTENCIA FLOTANTE (REEMPLAZA ALERT NATIVO) */}
      {toastAdvertencia.activo && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: '90%', maxWidth: '420px', animation: 'slideDown 0.5s ease-out' }}>
          <div style={{ backgroundColor: '#FEF3C7', borderLeft: '5px solid #F59E0B', padding: '1.2rem 1.5rem', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#F59E0B', borderRadius: '50%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle color="white" size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#92400E', fontSize: '1rem', fontWeight: 700, fontFamily: "'Open Sans', sans-serif" }}>Aviso Importante</h4>
              <p style={{ margin: '4px 0 0 0', color: '#B45309', fontSize: '0.85rem', fontFamily: "'Open Sans', sans-serif" }}>{toastAdvertencia.mensaje}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClienteDashboard;