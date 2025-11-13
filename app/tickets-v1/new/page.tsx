'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { USUARIO_ACTUAL } from '@/lib/auth';

const DESCRIPCIONES = [
  'Alarmas en Gestor',
  'Alarmas Externas', 
  'Caida',
  'Caida de clientes',
  'Corte_Energia',
  'Energia',
  'MBTS',
  'Solicitud cliente',
  'TX'
];

const TIPOS = [
  'CORTE ENERGIA',
  'ENERGIA',
  'MBTS',
  'PEXT - Atenuacion de FO',
  'PEXT - Corte de FO',
  'PEXT - Falsa Averia',
  'RADIO',
  'RED - TRANSPORTE DE RED',
  'SEGURIDAD',
  'SISTEMA ELECTRICO',
  'TX'
];

const ESTADOS = ['NUEVO', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'];

export default function NuevoTicketV1() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [cuadrillas, setCuadrillas] = useState<any[]>([]);
  const [siteQ, setSiteQ] = useState('');
  const [siteOpts, setSiteOpts] = useState<any[]>([]);
  const [tiposAtencion, setTiposAtencion] = useState<any[]>([]);
  const [plataformasAfectadas, setPlataformasAfectadas] = useState<any[]>([]);
  const [serviciosAfectados, setServiciosAfectados] = useState<any[]>([]);
  const [nivelesFalla, setNivealesFalla] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    ticket_source: '',
    task_category: '',
    task_subcategory: '',
    fault_level: '',
    estado: 'NUEVO',
    platform_affected: '',
    attention_type: '',
    service_affected: '',
    site_id: '',
    site_name: '',
    created_by: '',
    cuadrilla_id: ''
  });

  useEffect(() => {
    // Cargar cuadrillas activas
    supabase.from('cuadrillas').select('id,codigo,nombre').eq('activo', true)
      .then(({ data }) => setCuadrillas(data || []));
    
    // Cargar tipos de atención desde catalogo_tipo_atencion
    supabase.from('catalogo_tipo_atencion').select('id,nombre').eq('activo', true)
      .then(({ data }) => setTiposAtencion(data || []));
    
    // Cargar plataformas afectadas - probando diferentes nombres de tabla
    supabase.from('catalogo_pla_afectada').select('*')
      .then(({ data, error }) => {
        if (error) {
          console.log('Error con catalogo_pla_afectada (minúsculas):', error);
          // Probar con el nombre original
          supabase.from('catalogo_pla_Afectada').select('*')
            .then(({ data, error }) => {
              if (error) {
                console.log('Error con catalogo_pla_Afectada:', error);
              } else if (data) {
                console.log('Plataformas afectadas data (mixtas):', data);
                setPlataformasAfectadas(data || []);
              }
            });
        } else {
          console.log('Plataformas afectadas data (minúsculas):', data);
          setPlataformasAfectadas(data || []);
        }
      });

    // Cargar servicios afectados
    console.log('Intentando cargar servicios afectados...');
    supabase.from('catalogo_serv_afectado').select('*')
      .then(({ data, error }) => {
        console.log('Resultado servicios afectados:', { data, error });
        if (!error && data) {
          setServiciosAfectados(data);
          console.log('Servicios cargados exitosamente:', data.length);
        }
      });

    // Cargar niveles de falla desde catalogo_falla
    console.log('Intentando cargar niveles de falla...');
    supabase.from('catalogo_falla').select('*').eq('activo', true).order('codigo')
      .then(({ data, error }) => {
        console.log('Resultado niveles de falla:', { data, error });
        if (!error && data) {
          setNivealesFalla(data);
          console.log('Niveles de falla cargados exitosamente:', data.length);
        } else if (error) {
          console.log('Error cargando niveles de falla, usando valores por defecto');
          // Fallback a valores estáticos si la tabla no existe
          setNivealesFalla([
            { codigo: 'P3', nombre: 'BAJA' },
            { codigo: 'P2', nombre: 'MEDIA' },
            { codigo: 'P1', nombre: 'ALTA' },
            { codigo: 'P0', nombre: 'CRITICA' }
          ]);
        }
      });
  }, []);

  // Debug para verificar los datos cargados
  useEffect(() => {
    console.log('Estado plataformasAfectadas:', plataformasAfectadas);
  }, [plataformasAfectadas]);

  // Búsqueda de sites
  useEffect(() => {
    const id = setTimeout(async () => {
      if (!siteQ.trim()) { 
        setSiteOpts([]); 
        return; 
      }
      
      console.log('Buscando sites con:', siteQ);
      
      try {
        console.log('Buscando sites con término:', siteQ);
        
        // Primero intentar búsqueda por 'site' solamente
        const { data: searchData, error: searchError } = await supabase
          .from('sites_v1')
          .select('*')
          .ilike('site', `%${siteQ}%`)
          .limit(10);
          
        if (searchError) {
          console.error('Error buscando por site:', searchError);
          
          // Si falla, intentar por 'codigo'
          const { data: searchData2, error: searchError2 } = await supabase
            .from('sites_v1')
            .select('*')
            .ilike('codigo', `%${siteQ}%`)
            .limit(10);
            
          if (searchError2) {
            console.error('Error buscando por codigo:', searchError2);
            setSiteOpts([]);
          } else {
            console.log('Sites encontrados por codigo:', searchData2);
            setSiteOpts(searchData2 || []);
          }
        } else {
          console.log('Sites encontrados por site:', searchData);
          setSiteOpts(searchData || []);
        }
      } catch (err) {
        console.error('Error general en búsqueda:', err);
        setSiteOpts([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [siteQ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // El estado siempre debe permanecer como 'NUEVO' para tickets nuevos
    if (name === 'estado') {
      return; // Ignorar cambios al campo estado
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      // Validaciones básicas
      if (!formData.task_category || !formData.task_subcategory) {
        setMensaje('Los campos Categoría de Tarea y Subcategoría son obligatorios');
        setLoading(false);
        return;
      }
      // Validar cuadrilla_id opcional y convertir a entero si existe
      let cuadrillaIdValue = null;
      if (formData.cuadrilla_id && !isNaN(Number(formData.cuadrilla_id))) {
        cuadrillaIdValue = parseInt(formData.cuadrilla_id, 10);
      }
      const ticketData = {
        ticket_source: formData.ticket_source || null,
        task_category: formData.task_category || null,
        task_subcategory: formData.task_subcategory || null,
        fault_level: formData.fault_level,
        estado: 'NUEVO', // Siempre forzar estado NUEVO para tickets nuevos
        platform_affected: formData.platform_affected || null,
        attention_type: formData.attention_type || null,
        service_affected: formData.service_affected || null,
        site_id: formData.site_id || null,
        site_name: formData.site_name || null,
        created_by: USUARIO_ACTUAL() || 'Sistema',
        fault_occur_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('tickets_v1')
        .insert([ticketData])
        .select('id')
        .single();

      if (error) {
        console.error('Error al crear ticket:', error);
        setMensaje('Error al crear el ticket: ' + error.message);
        setLoading(false);
        return;
      }

      setMensaje('✅ Ticket V1 creado exitosamente');

      // Insertar registro en CUADRILLA_TICKET_ESTADOS
      if (data && data.id) {
        const registroEstado = {
          ticket_id: data.id,
          cuadrilla_id: cuadrillaIdValue,
          fecha_asignacion: new Date().toISOString(),
          usuario_creacion: USUARIO_ACTUAL() || 'Sistema',
          estado: 'NUEVO'
        };
        const { error: errorEstado } = await supabase
          .from('cuadrilla_ticket_estados')
          .insert([registroEstado]);
        if (errorEstado) {
          console.error('Error al registrar estado en cuadrilla_ticket_estados:', errorEstado);
        }
      }

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/tickets-v1');
      }, 2000);

    } catch (error) {
      console.error('Error inesperado:', error);
      setMensaje('Error inesperado al crear el ticket');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px' 
      }}>
        <h2 style={{ margin: 0, color: '#28a745' }}>Nuevo Ticket V1 📋</h2>
        <Link 
          href="/tickets-v1"
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px'
          }}
        >
          ← Volver a Tickets V1
        </Link>
      </div>

      {mensaje && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: mensaje.includes('Error') ? '#f8d7da' : '#d4edda',
          color: mensaje.includes('Error') ? '#721c24' : '#155724',
          border: `1px solid ${mensaje.includes('Error') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '6px',
          fontWeight: 'bold'
        }}>
          {mensaje}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ 
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        
        {/* Información básica */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>
            Información Básica
          </h3>
          
          <div style={{ marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Ticket
              </label>
              <input
                type="text"
                name="ticket_source"
                value={formData.ticket_source}
                onChange={handleInputChange}
                placeholder="Ingrese información del ticket"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Campo "Creado por" oculto - se llena automáticamente */}
          </div>
        </div>

        {/* Descripción del problema */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>
            Descripción del Problema
          </h3>
          
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Categoría de Tarea *
              </label>
              <select
                name="task_category"
                value={formData.task_category}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar descripción</option>
                {DESCRIPCIONES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Subcategoría de Tarea *
              </label>
              <select
                name="task_subcategory"
                value={formData.task_subcategory}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar tipo de falla</option>
                {TIPOS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Plataforma Afectada
              </label>
              <select
                name="platform_affected"
                value={formData.platform_affected}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar plataforma afectada</option>
                {plataformasAfectadas.map((plataforma) => (
                  <option key={plataforma.id} value={plataforma.nombre}>
                    {plataforma.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Clasificación */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>
            Clasificación
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Nivel de Falla
              </label>
              <select
                name="fault_level"
                value={formData.fault_level}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar nivel de falla</option>
                {nivelesFalla.map(nivel => (
                  <option key={nivel.codigo} value={nivel.nombre}>
                    {nivel.codigo} - {nivel.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Estado inicial
              </label>
              <input
                type="text"
                value="NUEVO"
                disabled
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#f8f9fa',
                  color: '#6c757d',
                  cursor: 'not-allowed'
                }}
              />
              <small style={{ color: '#6c757d', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                Los tickets nuevos siempre inician con estado NUEVO
              </small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Tipo de Atención
              </label>
              <select
                name="attention_type"
                value={formData.attention_type}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar tipo de atención</option>
                {tiposAtencion.map((tipo) => (
                  <option key={tipo.id} value={tipo.nombre}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Servicio Afectado
              </label>
              <select
                name="service_affected"
                value={formData.service_affected}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Seleccionar servicio afectado</option>
                {serviciosAfectados.map((servicio) => (
                  <option key={servicio.id} value={servicio.nombre}>
                    {servicio.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Site asociado */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>
            Site Asociado
          </h3>
          
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Buscar Site
            </label>
            <input
              type="text"
              value={siteQ}
              onChange={e => setSiteQ(e.target.value)}
              placeholder="Buscar por código o nombre del site"
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            
            {!!siteOpts.length && (
              <div style={{
                border: '1px solid #ddd',
                borderTop: 'none',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'white',
                borderRadius: '0 0 6px 6px'
              }}>
                {siteOpts.map((s: any, index: number) => (
                  <div
                    key={s.codigo || s.site || index}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onClick={() => {
                      setFormData(prev => ({ 
                        ...prev, 
                        site_id: s.codigo || '',
                        site_name: s.site || ''
                      }));
                      setSiteQ(`${s.codigo} - ${s.site}`);
                      setSiteOpts([]);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#007bff', fontSize: '14px' }}>
                          Código: {s.codigo}
                        </div>
                        <div style={{ fontSize: '14px', color: '#333', marginTop: '4px', fontWeight: '500' }}>
                          Site: {s.site}
                        </div>
                        {(s.address || s.direccion) && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{s.address || s.direccion}</div>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#007bff', fontWeight: 'bold' }}>
                        Seleccionar
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.site_id && formData.site_name && (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                backgroundColor: '#d4edda',
                border: '1px solid #c3e6cb',
                borderRadius: '6px',
                color: '#155724'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Site seleccionado:</div>
                <div style={{ marginBottom: '4px' }}><strong>Código:</strong> {formData.site_id}</div>
                <div><strong>Site:</strong> {formData.site_name}</div>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '30px' }}>
          <Link
            href="/tickets-v1"
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '16px'
            }}
          >
            Cancelar
          </Link>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? '🔄 Creando...' : '✅ Crear Ticket V1'}
          </button>
        </div>
      </form>
    </div>
  );
}