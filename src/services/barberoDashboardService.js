import { supabase } from '../supabase/client';

export const barberoDashboardService = {
  // Recibe la fecha elegida por el barbero
  obtenerCitasDelDia: async (barberoId, fechaElegida) => {
    const { data: citas, error } = await supabase
      .from('citas')
      .select(`
        id,
        cliente_nombre,
        cliente_telefono,
        fecha,
        hora,
        estado,
        barbero_id,
        servicio,
        precio  
      `)
      .eq('barbero_id', barberoId)
      .eq('fecha', fechaElegida) // Filtra por la fecha que le pase
      .order('hora', { ascending: true });

    if (error) {
      console.error("Error cargando agenda:", error.message);
      throw new Error("Error cargando la agenda del día");
    }
    
    return citas || [];
  },

  completarCita: async (citaId) => {
    const { data, error } = await supabase
      .from('citas')
      // Se fuerza que se guarde en minúscula para evitar problemas futuros
      .update({ estado: 'completada' }) 
      .eq('id', citaId)
      .select()
      .single();

    if (error) throw new Error("Error al completar el servicio: " + error.message);
    return data;
  }
};