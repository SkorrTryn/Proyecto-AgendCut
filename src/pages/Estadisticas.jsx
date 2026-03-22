import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, TrendingUp, Award, CalendarDays, DollarSign, Calendar, ChevronDown } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import logoAgendcut from '../assets/Logo.svg';
import { estadisticasService } from '../services/estadisticasService';

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

const Estadisticas = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [opcionesMeses] = useState(generarOpcionesMeses());
  const [mesSeleccionado, setMesSeleccionado] = useState(opcionesMeses[0].value); 
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const [datosIngresos, setDatosIngresos] = useState([]);
  const [datosServicios, setDatosServicios] = useState([]);
  const [insights, setInsights] = useState({
    totalMes: 0,
    mejorDia: { fecha: '-', ingresos: 0 },
    servicioEstrella: { nombre: '-', cantidad: 0 }
  });

  useEffect(() => {
    cargarYProcesarDatos();
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

  const cargarYProcesarDatos = async () => {
    try {
      setLoading(true);
      
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

      const citas = await estadisticasService.obtenerIngresosYServicios(primerDia, ultimoDia);
      
      if (!citas || citas.length === 0) {
        setDatosIngresos([]);
        setDatosServicios([]);
        setInsights({ totalMes: 0, mejorDia: { fecha: '-', ingresos: 0 }, servicioEstrella: { nombre: '-', cantidad: 0 } });
        setLoading(false);
        return;
      }

      let totalAcumulado = 0;
      const mapaIngresos = {};
      const mapaServicios = {};

      citas.forEach(cita => {
        const fechaObj = new Date(cita.fecha + 'T00:00:00'); 
        const diaFormateado = `${fechaObj.getDate()} ${fechaObj.toLocaleString('es-ES', { month: 'short' })}`;

        if (!mapaIngresos[diaFormateado]) mapaIngresos[diaFormateado] = 0;
        mapaIngresos[diaFormateado] += Number(cita.precio);
        totalAcumulado += Number(cita.precio);

        const serviciosArray = Array.isArray(cita.servicio) ? cita.servicio : [cita.servicio];
        
        serviciosArray.forEach(srv => {
          if (srv) {
            if (!mapaServicios[srv]) mapaServicios[srv] = 0;
            mapaServicios[srv] += 1;
          }
        });
      });

      const dataLineas = Object.keys(mapaIngresos).map(dia => ({
        fecha: dia,
        ingresos: mapaIngresos[dia]
      }));

      const dataBarras = Object.keys(mapaServicios).map(srv => ({
        nombre: srv,
        cantidad: mapaServicios[srv]
      })).sort((a, b) => b.cantidad - a.cantidad);

      let elMejorDia = { fecha: '-', ingresos: 0 };
      dataLineas.forEach(d => { if(d.ingresos > elMejorDia.ingresos) elMejorDia = d; });

      let elServicioEstrella = { nombre: '-', cantidad: 0 };
      if (dataBarras.length > 0) elServicioEstrella = dataBarras[0];

      setDatosIngresos(dataLineas);
      setDatosServicios(dataBarras);
      setInsights({
        totalMes: totalAcumulado,
        mejorDia: elMejorDia,
        servicioEstrella: elServicioEstrella
      });

    } catch (error) {
      console.error("Error procesando estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltipDolares = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ background: '#fff', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <p className="label" style={{ fontWeight: 600, color: '#374151', margin: '0 0 5px 0' }}>{label}</p>
          <p className="intro" style={{ color: '#B08D28', margin: 0, fontWeight: 700 }}>
            ${payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  
  const getMesActualLabel = () => {
    return opcionesMeses.find(op => op.value === mesSeleccionado)?.label || 'Seleccionar mes';
  };

  const nombreMesActivo = getMesActualLabel().split(' ')[0].toLowerCase() || 'este mes';

  return (
    <div className="dashboard-container">
      <header className={`n8n-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="n8n-header-content">
          <div className="brand-logo-n8n">
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

      {/* TÍTULO Y SELECTOR DE MESES */}
      <div className="welcome-section header-balanced" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div className="titles-container">
          <h2 className="admin-subtitle">Centro de comando</h2>
          <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: 0 }}>Análisis financiero</h1>
        </div>
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
      </div>

      {loading ? (
        <div className="loading-state"><Loader2 className="spinner" size={40} color="#B08D28" /></div>
      ) : datosIngresos.length === 0 ? (
        <div className="empty-state">
          <TrendingUp size={48} color="#9CA3AF" style={{ marginBottom: '1rem' }} />
          <p>Aún no hay ingresos registrados en <strong>{nombreMesActivo}</strong>.</p>
          <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Completa citas en este periodo para ver el análisis.</p>
        </div>
      ) : (
        <div className="estadisticas-content">
          
          <div className="insights-panel">
            <div className="insight-card highlight">
              <DollarSign className="insight-icon gold" size={24} />
              <div className="insight-info">
                <span className="insight-label">Ingresos del mes</span>
                <span className="insight-value text-gold">${insights.totalMes.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="insight-card">
              <CalendarDays className="insight-icon" size={24} />
              <div className="insight-info">
                <span className="insight-label">Día más fuerte</span>
                <span className="insight-value">{insights.mejorDia.fecha}</span>
                <span className="insight-subtext">${insights.mejorDia.ingresos.toLocaleString()} generados</span>
              </div>
            </div>

            <div className="insight-card">
              <Award className="insight-icon" size={24} />
              <div className="insight-info">
                <span className="insight-label">Servicio estrella</span>
                <span className="insight-value">{insights.servicioEstrella.nombre}</span>
                <span className="insight-subtext">Realizado {insights.servicioEstrella.cantidad} veces</span>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3 className="chart-title">Tendencia de ingresos diarios</h3>
              <p className="chart-subtitle">Flujo de caja durante {nombreMesActivo}</p>
              
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosIngresos} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="fecha" tick={{fill: '#6B7280', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{fill: '#6B7280', fontSize: 12}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(value) => `$${value/1000}k`} />
                    <Tooltip content={<CustomTooltipDolares />} />
                    <Line type="monotone" dataKey="ingresos" stroke="#B08D28" strokeWidth={3} dot={{ r: 4, fill: '#B08D28', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <h3 className="chart-title">Demanda de servicios</h3>
              <p className="chart-subtitle">Servicios más solicitados en {nombreMesActivo}</p>
              
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosServicios} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="nombre" tick={{fill: '#6B7280', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{fill: '#6B7280', fontSize: 12}} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{fill: 'rgba(176, 141, 40, 0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} />
                    <Bar dataKey="cantidad" fill="#111827" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Estadisticas;