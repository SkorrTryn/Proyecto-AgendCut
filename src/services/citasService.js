import { supabase } from '../supabase/client';

export const citasService = {
  // Obtener citas 
  obtenerCitas: async () => {
    const { data, error } = await supabase
      .from('citas')
      .select('*, barberos(nombre, foto_url)') // Pide la info de la tabla enlazada
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  // Verifica disponibilidad)
  verificarDisponibilidad: async (barberoId, fecha, hora, citaIdExcluida = null) => {
    let query = supabase
      .from('citas')
      .select('id')
      .eq('barbero_id', barberoId)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .neq('estado', 'Cancelada'); // Si está cancelada, la hora está libre

    // Si estamos editando una cita, ignoramos su propio ID para que no choque consigo misma
    if (citaIdExcluida) {
      query = query.neq('id', citaIdExcluida);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Retorna TRUE si la longitud es 0 (significa que está libre)
    return data.length === 0; 
  },

  // Crear cita
  crearCita: async (cita) => {
    const { data, error } = await supabase.from('citas').insert([cita]).select();
    if (error) throw error;
    return data;
  },

  // Actualizar cita
  actualizarCita: async (id, cita) => {
    const { data, error } = await supabase.from('citas').update(cita).eq('id', id).select();
    if (error) throw error;
    return data;
  },

  // Actualiza solo el estado (Drag & Drop del Kanban)
  actualizarEstado: async (id, estado) => {
    const { error } = await supabase.from('citas').update({ estado }).eq('id', id);
    if (error) throw error;
    return true;
  },

  // Eliminar cita
  eliminarCita: async (id) => {
    const { error } = await supabase.from('citas').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};