import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import { 
  ChevronDown, 
  LogOut, 
  BookOpen, 
  Loader2,
  Scissors, 
  CalendarDays, 
  Users, 
  Package, 
  ArrowRight, 
  Activity,
  TrendingUp,
  Calendar as CalendarIcon
} from 'lucide-react';
import logoAgendcut from '../assets/Logo.svg'; 

const AdminDashboard = () => {
  const navigate = useNavigate();
  const currentDate = "Viernes, 6 De Marzo De 2026"; 
  
  // Lógica del menú desplegable de usuario
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null); // Ref para detectar clics fuera

  // Estados para ocultar header al hacer scroll
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Lógica de arrastre y deslizamiento manual en carrusel
  const carouselRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isDragAction = useRef(false); // Destacado: Distingue un "clic" de un "arrastre" continuo

  const handleMouseDown = (e) => {
    if (!carouselRef.current) return;
    isDragging.current = true;
    isDragAction.current = false; // Se resetea la acción al inicio
    carouselRef.current.classList.add('dragging');
    startX.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeft.current = carouselRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (carouselRef.current) carouselRef.current.classList.remove('dragging');
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (carouselRef.current) carouselRef.current.classList.remove('dragging');
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !carouselRef.current) return;
    e.preventDefault(); // Evita que un arrastre resalte el texto
    const x = e.pageX - carouselRef.current.offsetLeft;
    
    
    if (Math.abs(x - startX.current) > 5) { // Logica: Si la distancia es mayor a 5px, significa que el usuario está arrastrando la tarjeta (y bloquea un posible clic)
      isDragAction.current = true;
    }

    const walk = (x - startX.current) * 1.5; // Multiplicador para dar un efecto de fluidez
    carouselRef.current.scrollLeft = scrollLeft.current - walk;
  };

  // Función para cerrar sesión 
  const handleLogout = async () => {
    alert("Cerrando sesión en AgendCut...");
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Efecto para cerrar el menú si se hace clic por fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Efecto para detectar scroll y ocultar/mostrar el header
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


  // Estados para la base de datos
  const [citasHoy, setCitasHoy] = useState(0); // Inicio en en 0
  const [citasMes, setCitasMes] = useState(0); // Total del mes
  
  const [ingresosHoy, setIngresosHoy] = useState(0); // Dinero hoy
  const [porcentajeIngresos, setPorcentajeIngresos] = useState({ valor: 0, tendencia: 'neutral' }); // % vs ayer

  const [citasPendientes, setCitasPendientes] = useState(0); // Citas en estado 'Pendiente'
  const [barberosActivos, setBarberosActivos] = useState(0); // Contador dinámico de barberos
  const [cargandoCitas, setCargandoCitas] = useState(true);

  // Efecto para buscar las citas al cargar la página
  useEffect(() => {
    const cargarMetricas = async () => {
      try {
        // Formateo de fechas a YYYY-MM-DD sin problemas de zona horaria
        const formatearFecha = (fecha) => {
          const y = fecha.getFullYear();
          const m = String(fecha.getMonth() + 1).padStart(2, '0');
          const d = String(fecha.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const hoy = new Date();
        const strHoy = formatearFecha(hoy);

        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        const strAyer = formatearFecha(ayer);

        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        const strPrimerDiaMes = formatearFecha(primerDiaMes);
        const strUltimoDiaMes = formatearFecha(ultimoDiaMes);

        // Consultas supabase en paralelo para mayor velocidad
        const [
          { count: countHoy },
          { count: countMes },
          { count: countPendientes }, 
          { data: citasHoyData },
          { data: citasAyerData },
          { count: countBarberos } 
        ] = await Promise.all([
          // Total citas de hoy
          supabase.from('citas').select('*', { count: 'exact', head: true }).eq('fecha', strHoy),
          // Total citas de este mes
          supabase.from('citas').select('*', { count: 'exact', head: true }).gte('fecha', strPrimerDiaMes).lte('fecha', strUltimoDiaMes),
          // Citas Pendientes
          supabase.from('citas').select('*', { count: 'exact', head: true }).eq('estado', 'Pendiente'),
          // Ingresos HOY (Solo citas completadas)
          supabase.from('citas').select('precio').eq('fecha', strHoy).eq('estado', 'Completada'),
          // Ingresos AYER (Solo citas completadas)
          supabase.from('citas').select('precio').eq('fecha', strAyer).eq('estado', 'Completada'),
          // Cantidad de barberos registrados
          supabase.from('barberos').select('*', { count: 'exact', head: true })
        ]);

        // Actualización de datos citas
        setCitasHoy(countHoy || 0);
        setCitasMes(countMes || 0);
        setCitasPendientes(countPendientes || 0);
        setBarberosActivos(countBarberos || 0);

        // Logica matematica de ingresos
        const totalIngresosHoy = citasHoyData?.reduce((sum, cita) => sum + Number(cita.precio), 0) || 0;
        const totalIngresosAyer = citasAyerData?.reduce((sum, cita) => sum + Number(cita.precio), 0) || 0;

        setIngresosHoy(totalIngresosHoy);

        // Calculo del porcentaje de crecimiento/pérdida
        let calcPorcentaje = 0;
        let calcTendencia = 'neutral';

        if (totalIngresosAyer === 0 && totalIngresosHoy > 0) {
          calcPorcentaje = 100; // Logica: Si ayer hizo 0 y hoy hizo algo, es 100% de crecimiento
          calcTendencia = 'up';
        } else if (totalIngresosAyer > 0) {
          calcPorcentaje = ((totalIngresosHoy - totalIngresosAyer) / totalIngresosAyer) * 100;
          if (calcPorcentaje > 0) calcTendencia = 'up';
          else if (calcPorcentaje < 0) calcTendencia = 'down';
        }

        setPorcentajeIngresos({ valor: calcPorcentaje, tendencia: calcTendencia });

      } catch (error) {
        console.error("Error cargando métricas:", error);
      } finally {
        setCargandoCitas(false);
      }
    };

    cargarMetricas();
  }, []);
  


  const modulesData = [
    { id: "01", tag: "12 Reportes", title: "Estadísticas", subtitle: "ANÁLISIS DE SERVICIOS", desc: "Tendencias, servicios más solicitados y rendimiento general del negocio.", icon: <Activity size={28} strokeWidth={1.5} /> },
    { id: "02", tag: `${citasPendientes} Pendientes`, title: "Gestión de citas", subtitle: "AGENDA CENTRAL", desc: "Visualiza, crea y organiza citas por profesional, cliente y horario.", icon: <CalendarDays size={28} strokeWidth={1.5} />, path: '/citas' },
    { id: "03", tag: `${barberosActivos} Activos`, title: "Por barbero", subtitle: "RENDIMIENTO DIARIO", desc: "Consulta cuántos servicios realizó cada profesional durante el día.", icon: <Users size={28} strokeWidth={1.5} /> },
    { id: "04", tag: "3 Alertas", title: "Inventario", subtitle: "PRODUCTOS & STOCK", desc: "Controla productos, niveles de stock y alertas de reposición en tiempo real.", icon: <Package size={28} strokeWidth={1.5} /> }
  ];

  return (
    <div className="dashboard-container">
      {/* Header con estilo n8n */}
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          
          <div className="brand-logo-n8n">
            <img src={logoAgendcut} alt="AgendCut Logo" />
            <div className="brand-text">
              <span className="brand-name">AgendCut</span>
              <span className="brand-badge-n8n">ADMIN</span>
            </div>
          </div>

          {/* Contenedor del Usuario con menú Desplegable */}
          <div className="user-menu-container" ref={dropdownRef}>
            <button 
              className={`user-profile-button ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="avatar-circle-n8n">A</div>
              <ChevronDown size={18} className="chevron-icon" />
            </button>

            {/* Menú Desplegable */}
            {isDropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-header">
                  <p className="dropdown-user-name">Administrador</p>
                  <p className="dropdown-user-role">SaaS Owner</p>
                </div>
                
                <div className="dropdown-divider"></div>

                {/* Botón 1: Guía de uso*/}
                <button className="dropdown-item" onClick={() => window.open('https://unidadestecno-my.sharepoint.com/:b:/g/personal/dlnovoa_uts_edu_co/IQDDBZdSSzBETYyKDbyCuKRbARd0gOTYaEcNZVvI2OGrYlE?e=D8Fpx1', '_blank')}>
                  <BookOpen size={18} />
                  Guía de uso
                </button>

                <div className="dropdown-divider"></div>

                {/* Botón 2: Cerrar sesión */}
                <button className="dropdown-item logout-btn-n8n" onClick={handleLogout}>
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="welcome-section">
        <div className="admin-subtitle">Panel de administración</div>
        <h1 className="welcome-title">Bienvenido, Administrador.</h1>
        <p className="welcome-text">Gestiona tu negocio con precisión. Selecciona un módulo para comenzar.</p>
      </section>

      {/* TARJETAS DE MÉTRICAS PRINCIPALES */}
      <section className="stats-grid">
        
        {/* TARJETA 1: Citas del Día/Mes */}
        <div className="stat-card">
          <h2 className="stat-value">{cargandoCitas ? '...' : citasHoy}</h2>
          <p className="stat-label">Citas hoy</p>
          <span className="stat-trend text-blue">
            {citasMes} en total este mes
          </span>
        </div>

        {/* TARJETA 2: Ingresos del Día y % vs Ayer */}
        <div className="stat-card">
          <h2 className="stat-value">${ingresosHoy.toLocaleString()}</h2>
          <p className="stat-label">Ingresos del día (Completadas)</p>
          <span className={`stat-trend ${
            porcentajeIngresos.tendencia === 'up' ? 'text-green' : 
            porcentajeIngresos.tendencia === 'down' ? 'text-red' : 'text-gray'
          }`}>
            {porcentajeIngresos.tendencia === 'up' ? '+' : ''}
            {porcentajeIngresos.valor.toFixed(1)}% vs ayer
          </span>
        </div>

        {/* TARJETA 3: Profesionales activos */}
        <div className="stat-card">
          <h2 className="stat-value">{cargandoCitas ? '...' : barberosActivos}</h2>
          <p className="stat-label">Profesionales</p>
          <span className="stat-trend text-gold">activos en el sistema</span>
        </div>

      </section>

      {/* SECCIÓN DE MÓDULOS (CARRUSEL INTERACTIVO) */}
      <div className="modules-section">
        <div className="modules-header-flex">
          <h2 className="modules-section-title">Módulos Disponibles</h2>
        </div>

        {/* Contenedor principal del carrusel con slider */}
        <div className="carousel-wrapper">
          <div 
            className="modules-grid carousel-grid" 
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            
            {/* TARJETA 1: GESTIÓN DE CITAS (Igual a la que tienes) */}
            <div className="module-card" onClick={() => { if (!isDragAction.current) navigate('/citas'); }} style={{ cursor: 'pointer' }}>
              <div className="card-content">
                <span className="module-tag" style={{ color: citasPendientes > 0 ? '#E65100' : 'var(--text-secondary)' }}>
                  {citasPendientes} PENDIENTES
                </span>
                <CalendarIcon className="module-icon" size={32} />
                <h3 className="module-title">Gestión de citas</h3>
                <p className="module-subtitle">AGENDA CENTRAL</p>
                <p className="module-desc">Visualiza, crea y organiza citas en tiempo real. Controla la fila de espera de forma eficiente.</p>
                <div className="module-link">Abrir ➔</div>
              </div>
              <div className="module-bg-number">01</div>
            </div>

            {/* TARJETA 2: ESTADÍSTICAS */}
            <div className="module-card" onClick={() => { if (!isDragAction.current) navigate('/estadisticas'); }} style={{ cursor: 'pointer' }}>
              <div className="card-content">
                <span className="module-tag">REPORTES</span>
                <TrendingUp className="module-icon" size={32} />
                <h3 className="module-title">Estadísticas</h3>
                <p className="module-subtitle">INGRESOS Y RENDIMIENTO</p>
                <p className="module-desc">Analiza las gráficas financieras del negocio para identificar tendencias y evaluar la demanda de servicios. </p>
                <div className="module-link">Abrir ➔</div>
              </div>
              <div className="module-bg-number">02</div>
            </div>

            {/* TARJETA 3: POR BARBERO (NUEVO: NAVEGACIÓN ENLAZADA) */}
            <div className="module-card" onClick={() => { if (!isDragAction.current) navigate('/barberos'); }} style={{ cursor: 'pointer' }}>
              <div className="card-content">
                <span className="module-tag">EQUIPO</span>
                <Users className="module-icon" size={32} />
                <h3 className="module-title">Por barbero</h3>
                <p className="module-subtitle">GESTIÓN DE PROFESIONALES</p>
                <p className="module-desc">Crea los perfiles de los empleados y asigna los servicios que ofrecen profesionalmente.</p>
                <div className="module-link">Abrir ➔</div>
              </div>
              <div className="module-bg-number">03</div>
            </div>

            {/* TARJETA 4: INVENTARIO (Igual) */}
            <div className="module-card" onClick={() => { if (!isDragAction.current) navigate('/inventario'); }} style={{ cursor: 'pointer' }}>
              <div className="card-content">
                <span className="module-tag">PRODUCTOS</span>
                <Package className="module-icon" size={32} />
                <h3 className="module-title">Inventario</h3>
                <p className="module-subtitle">CONTROL DE STOCK</p>
                <p className="module-desc">Administra productos de venta y uso interno. Recibe alertas de stock bajo.</p>
                <div className="module-link">Abrir ➔</div>
              </div>
              <div className="module-bg-number">04</div>
            </div>

            {/* TARJETA 5: GESTIÓN DE SERVICIOS */}
            <div className="module-card" onClick={() => { if (!isDragAction.current) navigate('/servicios'); }} style={{ cursor: 'pointer' }}>
              <div className="card-content">
                <span className="module-tag">CATÁLOGO</span>
                <Scissors className="module-icon" size={32} />
                <h3 className="module-title">Gestión de servicios</h3>
                <p className="module-subtitle">PRECIOS Y DURACIÓN</p>
                <p className="module-desc">Administra tu catálogo. Añade, edita precios o ajusta el tiempo en minutos de cada servicio.</p>
                <div className="module-link">Abrir ➔</div>
              </div>
              <div className="module-bg-number">05</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;