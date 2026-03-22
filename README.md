# AgendCut - Sistema de gestión de sistemas para micrioempresas de belleza/estetica

AgendCut es una plataforma web integral diseñada para optimizar la administración de servicios en el sector de la estética masculina. La aplicación facilita la interacción entre clientes y barberos, permitiendo una gestión eficiente de agendas y perfiles de usuario.

## Funcionalidades Principales

### Panel de Cliente

- **Registro y Autenticación:** Sistema de creación de cuentas con validación de datos y recuperación de contraseñas mediante servicios de correo electrónico.
- **Agendamiento Automatizado:** Interfaz para la selección de servicios, profesionales y horarios disponibles.
- **Gestión de Citas:** Módulo de consulta donde el usuario puede visualizar el historial y estado de sus reservas activas.

### Panel de Barbero y Administrador

- **Control de Agenda:** Visualización en tiempo real de los servicios programados, incluyendo información detallada del cliente y el horario.
- **Gestión de Usuarios:** Administración de perfiles y roles para garantizar el flujo operativo del establecimiento.

## Tecnologías Utilizadas

- **Frontend:** React.js para la construcción de una interfaz de usuario dinámica y responsiva.
- **Backend como Servicio (BaaS):** Supabase para la gestión de autenticación, base de datos PostgreSQL y políticas de seguridad RLS (Row Level Security).
- **Notificaciones:** Integración con EmailJS para el envío automatizado de confirmaciones y tickets de servicio.
- **Estilos y Componentes:** CSS moderno y Lucide-react para la iconografía del sistema.

## Arquitectura de Seguridad

La plataforma implementa políticas de seguridad a nivel de fila (RLS) en la base de datos, asegurando que cada usuario acceda exclusivamente a la información permitida según su rol y credenciales de autenticación.
