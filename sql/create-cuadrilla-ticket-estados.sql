-- Script para crear la tabla de asignaciones de cuadrillas a tickets
CREATE TABLE IF NOT EXISTS CUADRILLA_TICKET_ESTADOS (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    cuadrilla_id INTEGER NOT NULL,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT NOW(),
    usuario_creacion VARCHAR(100) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'ASIGNACION'
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_cuadrilla_ticket_estados_ticket_id ON CUADRILLA_TICKET_ESTADOS(ticket_id);
CREATE INDEX IF NOT EXISTS idx_cuadrilla_ticket_estados_cuadrilla_id ON CUADRILLA_TICKET_ESTADOS(cuadrilla_id);
