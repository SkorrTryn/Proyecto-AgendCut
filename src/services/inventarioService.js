import { supabase } from '../supabase/client';

export const inventarioService = {
  // 1. gestión del catálogo (tabla productos)
  obtenerProductos: async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  crearProducto: async (producto) => {
    const { data, error } = await supabase
      .from('productos')
      .insert([producto])
      .select();
      
    if (error) throw error;
    return data;
  },

  actualizarProducto: async (id, producto) => {
    const { data, error } = await supabase
      .from('productos')
      .update(producto)
      .eq('id', id)
      .select();
      
    if (error) throw error;
    return data;
  },

  eliminarProducto: async (id) => {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  },

  // 2. movimientos y egresos (tabla compras)
  // Esta es la función "mágica" que gasta el dinero y suma el stock al mismo tiempo
  registrarCompra: async (compra, stockActual) => {
    // 1. Registramos el gasto en el libro contable
    const { error: errorCompra } = await supabase
      .from('compras_inventario')
      .insert([{
        producto_id: compra.producto_id,
        cantidad: compra.cantidad,
        costo_total: compra.costo_total,
        fecha: compra.fecha
      }]);
      
    if (errorCompra) throw errorCompra;

    // 2. Le sumamos esa cantidad al stock físico del producto
    const nuevoStock = Number(stockActual) + Number(compra.cantidad);
    const { error: errorStock } = await supabase
      .from('productos')
      .update({ stock_actual: nuevoStock })
      .eq('id', compra.producto_id);

    if (errorStock) throw errorStock;
    
    return true;
  },

  // Función para descontar stock (cuando se gasta un insumo en la barbería)
  ajustarStockManual: async (id, nuevoStock) => {
    const { error } = await supabase
      .from('productos')
      .update({ stock_actual: nuevoStock })
      .eq('id', id);
      
    if (error) throw error;
    return true;
  },

  // 3. métricas financieras
  // Trae todos los gastos de un mes específico para nuestro "Centro de Comando"
  obtenerGastosPorMes: async (fechaInicio, fechaFin) => {
    const { data, error } = await supabase
      .from('compras_inventario')
      .select('costo_total, cantidad, productos(nombre)')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);
      
    if (error) throw error;
    return data;
  }
};