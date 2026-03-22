import { supabase } from '../supabase/client';

export const estadisticasService = {
  // Se obtienen las citas cobradas (Completadas) de un rango de fechas
  obtenerIngresosYServicios: async (fechaInicio, fechaFin) => {
    const { data, error } = await supabase
      .from('citas')
      .select('id, fecha, precio, servicio')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .eq('estado', 'Completada') 
      .order('fecha', { ascending: true });
      
    if (error) throw error;
    return data;
  }
};