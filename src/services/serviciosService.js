import { supabase } from '../supabase/client';

export const serviciosService = {
  obtenerServiciosActivos: async () => {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  crearServicio: async (nuevoServicio) => {
    const { data, error } = await supabase
      .from('servicios')
      .insert([nuevoServicio])
      .select();
      
    if (error) throw error;
    return data;
  },

  actualizarServicio: async (id, datosActualizados) => {
    const { data, error } = await supabase
      .from('servicios')
      .update(datosActualizados)
      .eq('id', id)
      .select();
      
    if (error) throw error;
    return data;
  },

  eliminarServicio: async (id) => {
    // En lugar de borrarlo físicamente y romper citas pasadas, se oculta (Soft Delete)
    const { error } = await supabase
      .from('servicios')
      .update({ activo: false })
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }
};