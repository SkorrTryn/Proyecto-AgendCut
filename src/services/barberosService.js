import { supabase } from '../supabase/client';

export const barberosService = {
  // Obtener la lista 
  obtenerBarberos: async () => {
    const { data, error } = await supabase
      .from('barberos')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Crear barbero llamando a la Edge Function
  crearBarbero: async (formData, fotoFile) => {
    let foto_url = null;
    
    // Si el admin subió una foto, la almacenamiento de primero en el Storage
    if (fotoFile) {
      const fileExt = fotoFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, fotoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      foto_url = publicUrl;
    }

    // Llamado al "Gerente" (Edge Function) para que encripte la y guarde todo
    const { data, error } = await supabase.functions.invoke('admin-barberos', {
      body: {
        action: 'CREAR_BARBERO',
        payload: { ...formData, foto_url }
      }
    });

    if (error) throw new Error(error.message);
    return data;
  },

  // Editar barbero llamando a la Edge Function
  editarBarbero: async (id, datosActualizados, fotoFile) => {
    let foto_url = datosActualizados.foto_url; 
    
    if (fotoFile) {
      const fileExt = fotoFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, fotoFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      foto_url = publicUrl;
    }

    // Le redirección a todo al Gerente (Edge Function) para que él se encargue de ambas tablas
    const { data, error } = await supabase.functions.invoke('admin-barberos', {
      body: {
        action: 'EDITAR_BARBERO',
        payload: { id, ...datosActualizados, foto_url } // Viajan los datos y el password si lo hay
      }
    });

    if (error) throw new Error(error.message);
    return true;
  },

  // Eliminar
  eliminarBarbero: async (id) => {
    // Llamamos al Gerente (Edge Function) para un borrado seguro y completo
    const { data, error } = await supabase.functions.invoke('admin-barberos', {
      body: {
        action: 'ELIMINAR_BARBERO',
        payload: { id }
      }
    });

    if (error) throw new Error(error.message);
    return true;
  }
};