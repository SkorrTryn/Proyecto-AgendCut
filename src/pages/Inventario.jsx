import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, ArrowLeft, Plus, Calendar, ChevronDown, 
  ShoppingCart, AlertTriangle, Package, Edit, MinusCircle 
} from 'lucide-react';
import logoAgendcut from '../assets/Logo.svg';
import { inventarioService } from '../services/inventarioService';

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

const Inventario = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de Datos
  const [productos, setProductos] = useState([]);
  const [gastoTotalMes, setGastoTotalMes] = useState(0);

  // Estados del Selector de Meses
  const [opcionesMeses] = useState(generarOpcionesMeses());
  const [mesSeleccionado, setMesSeleccionado] = useState(opcionesMeses[0].value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Estados para Modales
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  const [modalCompraOpen, setModalCompraOpen] = useState(false);
  const [modalAjusteOpen, setModalAjusteOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  
  const [productoActual, setProductoActual] = useState(null); // Para saber a cuál le estamos comprando/ajustando

  // Formularios
  const [formProducto, setFormProducto] = useState({ nombre: '', unidad_medida: 'Unidades', stock_actual: 0, stock_minimo: 5 });
  const [formCompra, setFormCompra] = useState({ cantidad: '', costo_total: '', fecha: new Date().toISOString().split('T')[0] });
  const [formAjuste, setFormAjuste] = useState({ stock_actual: 0 });

  // Efecto principal (escucha el mes)
  useEffect(() => {
    cargarDatos();
  }, [mesSeleccionado]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const [year, month] = mesSeleccionado.split('-');
      const formatYYYYMMDD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const primerDia = formatYYYYMMDD(new Date(year, Number(month) - 1, 1));
      const ultimoDia = formatYYYYMMDD(new Date(year, Number(month), 0)); 

      // Extracción de catálogo y gastos del mes en paralelo
      const [catalogoData, gastosData] = await Promise.all([
        inventarioService.obtenerProductos(),
        inventarioService.obtenerGastosPorMes(primerDia, ultimoDia)
      ]);

      setProductos(catalogoData || []);
      
      // Sumamos el dinero gastado en ese mes
      const totalGastado = (gastosData || []).reduce((sum, gasto) => sum + Number(gasto.costo_total), 0);
      setGastoTotalMes(totalGastado);

    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers de modales
  // 1. Producto (Catálogo)
  const abrirModalCrearProducto = () => {
    setModoEdicion(false);
    setProductoActual(null);
    setFormProducto({ nombre: '', unidad_medida: 'Unidades', stock_actual: 0, stock_minimo: 5 });
    setModalProductoOpen(true);
  };

  const abrirModalEditarProducto = (prod) => {
    setModoEdicion(true);
    setProductoActual(prod);
    setFormProducto({ nombre: prod.nombre, unidad_medida: prod.unidad_medida, stock_actual: prod.stock_actual, stock_minimo: prod.stock_minimo });
    setModalProductoOpen(true);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modoEdicion) {
        await inventarioService.actualizarProducto(productoActual.id, formProducto);
      } else {
        await inventarioService.crearProducto(formProducto);
      }
      setModalProductoOpen(false);
      cargarDatos();
    } catch (error) {
      console.error("Error guardando producto:", error);
    } finally {
      setSaving(false);
    }
  };

  const eliminarProducto = async () => {
    const confirmar = window.confirm("¿Estás seguro de que deseas eliminar este insumo? Esta acción es irreversible.");
    if (!confirmar) return;

    try {
      setSaving(true);
      await inventarioService.eliminarProducto(productoActual.id);
      setModalProductoOpen(false);
      cargarDatos();
    } catch (error) {
      console.error("Error eliminando producto:", error);
      alert("No se pudo eliminar el insumo. Es posible que tenga compras asociadas.");
    } finally {
      setSaving(false);
    }
  };

  // 2. Compra (Ingreso de dinero/stock)
  const abrirModalCompra = (prod) => {
    setProductoActual(prod);
    setFormCompra({ cantidad: '', costo_total: '', fecha: new Date().toISOString().split('T')[0] });
    setModalCompraOpen(true);
  };

  const registrarCompra = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const compraObj = {
        producto_id: productoActual.id,
        cantidad: Number(formCompra.cantidad),
        costo_total: Number(formCompra.costo_total),
        fecha: formCompra.fecha
      };
      await inventarioService.registrarCompra(compraObj, productoActual.stock_actual);
      setModalCompraOpen(false);
      cargarDatos();
    } catch (error) {
      console.error("Error registrando compra:", error);
    } finally {
      setSaving(false);
    }
  };

  // 3. Ajuste (Consumo manual)
  const abrirModalAjuste = (prod) => {
    setProductoActual(prod);
    setFormAjuste({ stock_actual: prod.stock_actual });
    setModalAjusteOpen(true);
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventarioService.ajustarStockManual(productoActual.id, Number(formAjuste.stock_actual));
      setModalAjusteOpen(false);
      cargarDatos();
    } catch (error) {
      console.error("Error ajustando stock:", error);
    } finally {
      setSaving(false);
    }
  };

  // Lógica de semáforo y métricas
  const productosEnAlerta = productos.filter(p => p.stock_actual <= p.stock_minimo).length;
  const nombreMesActivo = opcionesMeses.find(op => op.value === mesSeleccionado)?.label.split(' ')[0] || 'Mes';

  const getSemaforoInfo = (actual, minimo) => {
    if (actual === 0) return { clase: 'status-cancelled', texto: 'Agotado' }; // Rojo
    if (actual <= minimo) return { clase: 'status-pending', texto: 'Reabastecer' }; // Amarillo/Naranja
    return { clase: 'status-completed', texto: 'Suficiente' }; // Verde
  };

  return (
    <div className="dashboard-container">
      <header className="n8n-header">
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
          <h2 className="admin-subtitle">Control de egresos</h2>
          <h1 className="welcome-title" style={{ fontSize: '2.5rem', marginBottom: 0 }}>Inventario operativo</h1>
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
                <span className="current-month-text">{opcionesMeses.find(op => op.value === mesSeleccionado)?.label}</span>
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
                      onClick={() => { setMesSeleccionado(opcion.value); setIsDropdownOpen(false); }}
                    >
                      {opcion.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="primary-button" onClick={abrirModalCrearProducto}>
            <Plus size={18} /> Nuevo insumo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><Loader2 className="spinner" size={40} color="#B08D28" /></div>
      ) : (
        <div className="estadisticas-content">
          
          {/* Tarjetas de insights*/}
          <div className="insights-panel" style={{ marginBottom: '2rem' }}>
            <div className="insight-card highlight" style={{ borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
              <ShoppingCart className="insight-icon" size={24} style={{ color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }} />
              <div className="insight-info">
                <span className="insight-label">Gastos en {nombreMesActivo}</span>
                <span className="insight-value" style={{ color: '#EF4444' }}>${gastoTotalMes.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="insight-card">
              <AlertTriangle className="insight-icon" size={24} style={{ color: productosEnAlerta > 0 ? '#F59E0B' : '#10B981', backgroundColor: productosEnAlerta > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)' }} />
              <div className="insight-info">
                <span className="insight-label">Alertas de stock</span>
                <span className="insight-value">{productosEnAlerta}</span>
                <span className="insight-subtext">Productos por agotarse</span>
              </div>
            </div>

            <div className="insight-card">
              <Package className="insight-icon" size={24} />
              <div className="insight-info">
                <span className="insight-label">Catálogo interno</span>
                <span className="insight-value">{productos.length}</span>
                <span className="insight-subtext">Tipos de insumos registrados</span>
              </div>
            </div>
          </div>

          {/* Tabla de inventario*/}
          {productos.length === 0 ? (
            <div className="empty-state">
              <Package size={48} color="#E5E7EB" style={{marginBottom: '1rem'}} />
              <p>No tienes productos registrados en tu catálogo.</p>
              <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Haz clic en "Nuevo Insumo" para empezar a gestionar tu bodega.</p>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidad</th>
                      <th>Stock mínimo</th>
                      <th>Stock actual</th>
                      <th>Estado</th>
                      <th>Acciones operativas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((prod) => {
                      const semaforo = getSemaforoInfo(prod.stock_actual, prod.stock_minimo);
                      return (
                        <tr key={prod.id}>
                          <td className="fw-600">{prod.nombre}</td>
                          <td>{prod.unidad_medida}</td>
                          <td className="text-muted">{prod.stock_minimo}</td>
                          <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{prod.stock_actual}</td>
                          <td>
                            <span className={`status-badge ${semaforo.clase}`}>
                              {semaforo.texto}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className="action-btn" onClick={() => abrirModalCompra(prod)} title="Registrar Compra" style={{ color: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                Gastos
                              </button>
                              <button className="action-btn" onClick={() => abrirModalAjuste(prod)} title="Descontar consumo" style={{ color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                Ajustar
                              </button>
                              <button className="action-link" onClick={() => abrirModalEditarProducto(prod)} title="Editar Catálogo">
                                <Edit size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

     

      {/* MODAL 1: CREAR/EDITAR PRODUCTO (CATÁLOGO) */}
      {modalProductoOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{modoEdicion ? 'Editar insumo' : 'Registrar nuevo insumo'}</h3>
              <button className="close-modal" onClick={() => setModalProductoOpen(false)}>×</button>
            </div>
            <form onSubmit={guardarProducto} className="modal-form">
              <div className="input-group">
                <label>Nombre del producto / marca</label>
                <input type="text" value={formProducto.nombre} onChange={e => setFormProducto({...formProducto, nombre: e.target.value})} placeholder="Ej. Cuchillas Dorco, Gel Ego..." required />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Unidad de medida</label>
                  <select value={formProducto.unidad_medida} onChange={e => setFormProducto({...formProducto, unidad_medida: e.target.value})} className="modal-select">
                    <option value="Unidades">Unidades (Tarros, Botes)</option>
                    <option value="Cajas">Cajas</option>
                    <option value="Paquetes">Paquetes</option>
                    <option value="Litros">Litros</option>
                    <option value="Rollos">Rollos</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Alerta mínima</label>
                  <input type="number" min="1" value={formProducto.stock_minimo} onChange={e => setFormProducto({...formProducto, stock_minimo: e.target.value})} required />
                </div>
              </div>
              {!modoEdicion && (
                <div className="input-group">
                  <label>Stock inicial (físico en bodega ahora)</label>
                  <input type="number" min="0" value={formProducto.stock_actual} onChange={e => setFormProducto({...formProducto, stock_actual: e.target.value})} required />
                </div>
              )}
              <div className="modal-footer" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {modoEdicion && (
                  <button type="button" className="delete-button" onClick={eliminarProducto} disabled={saving}>
                    Eliminar insumo
                  </button>
                )}
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <Loader2 className="spinner" size={18} /> : 'Guardar insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR COMPRA (GASTO + STOCK) */}
      {modalCompraOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar compra de insumos</h3>
              <button className="close-modal" onClick={() => setModalCompraOpen(false)}>×</button>
            </div>
            <form onSubmit={registrarCompra} className="modal-form">
              <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Producto: {productoActual?.nombre}</p>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#6B7280' }}>Stock actual antes de compra: {productoActual?.stock_actual} {productoActual?.unidad_medida}</p>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Cantidad comprada</label>
                  <input type="number" min="1" value={formCompra.cantidad} onChange={e => setFormCompra({...formCompra, cantidad: e.target.value})} placeholder={`Ej. 5 ${productoActual?.unidad_medida}`} required />
                </div>
                <div className="input-group">
                  <label>Costo total ($)</label>
                  <input type="number" min="1" value={formCompra.costo_total} onChange={e => setFormCompra({...formCompra, costo_total: e.target.value})} placeholder="Lo que pagaste en total" required />
                </div>
              </div>
              <div className="input-group">
                <label>Fecha de la compra</label>
                <input type="date" value={formCompra.fecha} onChange={e => setFormCompra({...formCompra, fecha: e.target.value})} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-button" onClick={() => setModalCompraOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving} style={{ backgroundColor: '#10B981', color: 'white', borderColor: '#10B981' }}>
                  {saving ? <Loader2 className="spinner" size={18} /> : 'Registrar gasto y sumar stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: AJUSTE MANUAL (DESCONTAR CONSUMO) */}
      {modalAjusteOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Ajustar stock (consumo)</h3>
              <button className="close-modal" onClick={() => setModalAjusteOpen(false)}>×</button>
            </div>
            <form onSubmit={guardarAjuste} className="modal-form">
              <div style={{ backgroundColor: 'rgba(245,158,11,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#B45309' }}>Producto: {productoActual?.nombre}</p>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#B45309' }}>Usa esto cuando saques un producto de la bodega para usarlo en la barbería.</p>
              </div>
              <div className="input-group">
                <label>¿Cuánto queda en la bodega realmente?</label>
                <input type="number" min="0" value={formAjuste.stock_actual} onChange={e => setFormAjuste({...formAjuste, stock_actual: e.target.value})} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-button" onClick={() => setModalAjusteOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <Loader2 className="spinner" size={18} /> : 'Actualizar inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;