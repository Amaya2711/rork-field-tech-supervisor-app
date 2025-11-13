'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import type { TicketV1 } from '@/lib/tickets/types'; // ✅ tipo correcto

interface Estado {
  id: number;
  codigo: string;
  nombre: string;
}

// 🔧 Tamaño de página
const PAGE_SIZE = 10;

// 🧩 Función auxiliar para validar objetos
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

// 🧩 Normaliza cualquier fila a la forma TicketV1 (string | null)
function toTicketV1(row: Record<string, any>): TicketV1 {
  return {
    id: String(row.id),
    ticket_source: row.ticket_source ?? null,
    site_id: row.site_id !== undefined && row.site_id !== null ? String(row.site_id) : null,
    site_name: row.site_name ?? null,
    fault_level: row.fault_level ?? null,
    fault_occur_time: row.fault_occur_time ?? null,
    complete_time: row.complete_time ?? null,
    task_category: row.task_category ?? null,
    task_subcategory: row.task_subcategory ?? null,
    platform_affected: row.platform_affected ?? null,
    attention_type: row.attention_type ?? null,
    service_affected: row.service_affected ?? null,
    estado: row.estado ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export default function TicketsV1Page() {
  const [rows, setRows] = useState<TicketV1[]>([]);
  const [loading, setLoading] = useState(false);
  const [qText, setQText] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<string>('');

  // Cargar estados del catálogo
  async function loadEstados() {
    try {
      const { data, error } = await supabase
        .from('catalogo_estados')
        .select('id, codigo, nombre')
        .order('nombre');
      
      if (error) {
        console.error('Error cargando estados:', error);
        return;
      }
      // Mapear para asegurar que cada estado tiene id, codigo y nombre
      setEstados((data || []).map((row: any) => ({
        id: row.id,
        codigo: row.codigo,
        nombre: row.nombre
      })));
    } catch (error) {
      console.error('Error cargando estados:', error);
    }
  }

  const SELECT = [
    'id',
    'ticket_source',
    'site_id',
    'site_name',
    'fault_level',
    'fault_occur_time',
    'complete_time',
    'task_category',
    'task_subcategory',
    'platform_affected',
    'attention_type',
    'service_affected',
    'estado',
    'created_at',
    'updated_at',
  ].join(',');

  function buildQuery() {
    let q = supabase
      .from('tickets_v1')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    // Filtro por estado
    if (selectedEstado && selectedEstado !== '') {
      q = q.eq('estado', selectedEstado);
    }

    // Filtro por texto
    const term = qText.trim();
    if (term) {
      q = q.or(
        [
          `ticket_source.ilike.%${term}%`,
          `site_id.ilike.%${term}%`,
          `site_name.ilike.%${term}%`,
          `fault_level.ilike.%${term}%`,
          `task_category.ilike.%${term}%`,
          `task_subcategory.ilike.%${term}%`,
          `platform_affected.ilike.%${term}%`,
          `attention_type.ilike.%${term}%`,
          `service_affected.ilike.%${term}%`,
          `estado.ilike.%${term}%`,
        ].join(',')
      );
    }

    return q;
  }

  // ✅ Función corregida
  async function load() {
    setLoading(true);
    const { data, error, count } = await buildQuery();
    setLoading(false);

    if (error) {
      console.error('Error loading tickets:', error);
      alert(error.message);
      setRows([]);
      setTotal(0);
      return;
    }

    // Verifica que sea array válido
    if (!Array.isArray(data)) {
      console.error('Formato inesperado (no es array):', data);
      setRows([]);
      setTotal(0);
      return;
    }

    // Si la respuesta parece error (GenericStringError[])
    if (data.length > 0 && isObject(data[0]) && 'error' in data[0]) {
      console.error('La consulta devolvió errores:', data);
      setRows([]);
      setTotal(0);
      return;
    }

    // Normaliza a TicketV1
    const normalized = data.filter(isObject).map((row) => toTicketV1(row));
    setRows(normalized);
    setTotal(count ?? normalized.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText, page, selectedEstado]);

  useEffect(() => {
    loadEstados();
  }, []);

  // 🧩 Funciones auxiliares de formato (sin cambios)
  const formatDateTime = (value: string | null) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString('es-ES');
    } catch {
      return value;
    }
  };

  const getEstadoStyle = (estado: string | null) => {
    if (!estado) {
      return { backgroundColor: '#f5f5f5', color: '#666', borderLeft: '3px solid #ccc' };
    }
    const e = estado.toLowerCase().trim();
    const map: Record<string, any> = {
      'en ejecución': { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' },
      'en ejecucion': { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' },
      asignado: { bg: '#e3f2fd', color: '#1565c0', border: '#2196f3' },
      'en espera': { bg: '#fff8e1', color: '#f57c00', border: '#ff9800' },
      'en ruta': { bg: '#f3e5f5', color: '#7b1fa2', border: '#9c27b0' },
      neutralizado: { bg: '#e0f2f1', color: '#00695c', border: '#26a69a' },
      validado: { bg: '#e8eaf6', color: '#283593', border: '#3f51b5' },
      nuevo: { bg: '#fff3e0', color: '#e65100', border: '#ff6f00' },
      completado: { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' },
      resuelto: { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' },
      finalizado: { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' },
      cancelado: { bg: '#f3f4f6', color: '#374151', border: '#6b7280' },
      anulado: { bg: '#f3f4f6', color: '#374151', border: '#6b7280' },
      pendiente: { bg: '#fef7cd', color: '#a16207', border: '#eab308' },
      urgente: { bg: '#ffebee', color: '#c62828', border: '#f44336' },
      crítico: { bg: '#ffebee', color: '#c62828', border: '#f44336' },
      revision: { bg: '#f0f4f8', color: '#475569', border: '#64748b' },
      bloqueado: { bg: '#fef2f2', color: '#dc2626', border: '#ef4444' },
      progreso: { bg: '#dbeafe', color: '#1d4ed8', border: '#3b82f6' },
      'en progreso': { bg: '#dbeafe', color: '#1d4ed8', border: '#3b82f6' },
    };
    const s = map[e] || { bg: '#f0f9ff', color: '#0369a1', border: '#0ea5e9' };
    return { backgroundColor: s.bg, color: s.color, borderLeft: `3px solid ${s.border}` };
  };

  // 🧩 JSX de la interfaz (sin cambios)
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#007bff' }}>Tickets 📋</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link href="/tickets-v1/new" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
            + Nuevo Ticket V1
          </Link>
          <div style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '14px' }}>
            Total: {total} tickets
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por ticket, site, nivel, categoría, plataforma, estado…"
          value={qText}
          onChange={(e) => {
            setPage(1);
            setQText(e.target.value);
          }}
          style={{ width: '100%', padding: '12px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '16px' }}
        />
      </div>

      {/* Filtros */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 'bold', color: '#495057', fontSize: '14px' }}>
            Estado:
          </label>
          <select
            value={selectedEstado}
            onChange={(e) => {
              setPage(1);
              setSelectedEstado(e.target.value);
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#495057',
              minWidth: '150px'
            }}
          >
            <option value="">Todas</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.nombre}>
                {estado.nombre}
              </option>
            ))}
          </select>
        </div>
        
        {(selectedEstado) && (
          <button
            onClick={() => {
              setPage(1);
              setSelectedEstado('');
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Estados de carga y sin resultados */}
      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#007bff', fontSize: '18px' }}>🔄 Cargando tickets...</div>}
      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#f8f9fa', borderRadius: '8px', color: '#6c757d' }}>
          <h3>No se encontraron tickets</h3>
          <p>Intenta cambiar los criterios de búsqueda o crea un nuevo ticket.</p>
        </div>
      )}

      {/* Tabla de resultados */}
      {!loading && rows.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ backgroundColor: '#007bff', color: 'white' }}>
                  {['Ticket', 'Site', 'Nivel', 'Categoría', 'Subcategoría', 'Estado', 'Creado', 'Mapa', 'Acciones'].map((h) => (
                    <th key={h} style={{ padding: '15px', textAlign: (h === 'Acciones' || h === 'Mapa') ? 'center' : 'left', fontWeight: 'bold' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 'bold', color: '#007bff' }}>{t.ticket_source || '(sin código)'}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{t.site_id ?? '-'}</strong>
                        <span style={{ color: '#666', fontSize: 12 }}>{t.site_name ?? ''}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>{t.fault_level ?? '-'}</td>
                    <td style={{ padding: '12px' }}>{t.task_category ?? '-'}</td>
                    <td style={{ padding: '12px' }}>{t.task_subcategory ?? '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-block',
                          minWidth: '80px',
                          textAlign: 'center',
                          ...getEstadoStyle(t.estado),
                        }}
                      >
                        {t.estado ?? 'Sin estado'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#666' }}>{formatDateTime(t.created_at)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <Link 
                        href={`/map-google?ticket=${t.id}`} 
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#28a745', 
                          color: 'white', 
                          textDecoration: 'none', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          display: 'inline-block' 
                        }}
                      >
                        MAPA
                      </Link>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {t.estado?.toLowerCase().trim() === 'resuelto' ? (
                        <span 
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#6c757d', 
                            color: 'white', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            opacity: 0.6,
                            cursor: 'not-allowed'
                          }}
                          title="No se puede editar un ticket resuelto"
                        >
                          No Editable
                        </span>
                      ) : (
                        <Link 
                          href={`/tickets-v1/${t.id}/edit`} 
                          style={{ 
                            padding: '6px 12px', 
                            backgroundColor: '#007bff', 
                            color: 'white', 
                            textDecoration: 'none', 
                            borderRadius: '4px', 
                            fontSize: '12px' 
                          }}
                        >
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '8px 16px', backgroundColor: page > 1 ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'not-allowed' }}>
              ← Anterior
            </button>

            <span style={{ fontWeight: 'bold' }}>
              Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))} ({total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} de {total})
            </span>

            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE)} style={{ padding: '8px 16px', backgroundColor: page < Math.ceil(total / PAGE_SIZE) ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: page < Math.ceil(total / PAGE_SIZE) ? 'pointer' : 'not-allowed' }}>
              Siguiente →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
