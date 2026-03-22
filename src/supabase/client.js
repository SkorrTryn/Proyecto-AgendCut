import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;// Accede a la URL pública de Supabase guardada en el archivo .env (usando Vite)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;// Accede a la de API pública de Supabase guardada en el archivo .env (usando Vite)

export const supabase = createClient(supabaseUrl, supabaseAnonKey);// Crea una instancia del cliente de Supabase utilizando la URL y la de API proporcionadas
