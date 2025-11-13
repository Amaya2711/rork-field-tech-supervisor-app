'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const REGIONES = [
  'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO',
  'CAJAMARCA', 'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO',
  'ICA', 'JUNIN', 'LA LIBERTAD', 'LAMBAYEQUE', 'LIMA',
  'LORETO', 'MADRE DE DIOS', 'MOQUEGUA', 'PASCO', 'PIURA',
  'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI'
];

export default function NewSiteV1Page() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    codigo: '',
    site: '',
    direccion: '',
    region: '',
    latitud: '',
    longitud: '',
  // tipo_site removed
    detalle: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.codigo.trim()) {
      errors.push('El código del site es obligatorio');
    }
    if (!formData.site.trim()) {
      errors.push('El nombre del site es obligatorio');
    }
    if (!formData.region) {
      errors.push('La región es obligatoria');
    }
    if (!formData.latitud.trim()) {
      errors.push('La latitud es obligatoria');
    } else {
      const lat = parseFloat(formData.latitud);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push('La latitud debe ser un número válido entre -90 y 90');
      }
    }
    if (!formData.longitud.trim()) {
      errors.push('La longitud es obligatoria');
    } else {
      const lng = parseFloat(formData.longitud);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push('La longitud debe ser un número válido entre -180 y 180');
      }
    }
    // Los demás campos no son obligatorios

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setMessage('❌ Errores de validación:\n' + errors.join('\n'));
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Verificar si el código ya existe
      const { data: existingSite } = await supabase
        .from('sites_v1')
        .select('codigo')
        .eq('codigo', formData.codigo.trim().toUpperCase())
        .single();

      if (existingSite) {
        setMessage('❌ Error: Ya existe un site con este código');
        setLoading(false);
        return;
      }

      const insertData = {
        codigo: formData.codigo.trim().toUpperCase(),
        site: formData.site.trim(),
        direccion: formData.direccion.trim() || null,
        region: formData.region,
        latitud: formData.latitud ? parseFloat(formData.latitud) : null,
        longitud: formData.longitud ? parseFloat(formData.longitud) : null,
  // tipo_site removed
        detalle: formData.detalle.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sites_v1')
        .insert([insertData])
        .select();

      if (error) {
        console.error('Error al crear site:', error);
        setMessage('❌ Error al crear el site: ' + error.message);
        setLoading(false);
        return;
      }

      setMessage('✅ Site V1 creado exitosamente');
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/sites-v1');
      }, 2000);

    } catch (error) {
      console.error('Error inesperado:', error);
      setMessage('❌ Error inesperado al crear el site');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#007bff' }}>Crear Nuevo Site V1 🏗️</h2>
        <Link href="/sites-v1" style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '6px' }}>← Volver a Sites V1</Link>
      </div>

      {message && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda', color: message.includes('Error') ? '#721c24' : '#155724', border: `1px solid ${message.includes('Error') ? '#f5c6cb' : '#c3e6cb'}`, borderRadius: '6px', whiteSpace: 'pre-line', fontWeight: 'bold' }}>{message}</div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        {/* Información básica */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Información Básica</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Código del Site *</label>
              <input type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} required placeholder="Ej: ABC123" style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px', textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre del Site *</label>
              <input type="text" name="site" value={formData.site} onChange={handleInputChange} required placeholder="Nombre descriptivo del site" style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección</label>
              <input type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} required placeholder="Dirección del site" style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Región *</label>
              <select name="region" value={formData.region} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px' }}>
                <option value="">Seleccionar región</option>
                {REGIONES.map(region => (<option key={region} value={region}>{region}</option>))}
              </select>
            </div>
                {/* Tipo de Site field removed: not present in DB */}
                {/* Estado field removed: not present in DB */}
          </div>
        </div>

        {/* Coordenadas geográficas */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Coordenadas Geográficas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Latitud</label>
              <input type="number" step="any" name="latitud" value={formData.latitud} onChange={handleInputChange} required placeholder="Ej: -12.0464" style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px' }} />
              <small style={{ color: '#666', fontSize: '12px' }}>Valor entre -90 y 90 grados</small>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Longitud</label>
              <input type="number" step="any" name="longitud" value={formData.longitud} onChange={handleInputChange} required placeholder="Ej: -77.0428" style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px' }} />
              <small style={{ color: '#666', fontSize: '12px' }}>Valor entre -180 y 180 grados</small>
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Detalle</h3>
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notas adicionales</label>
            <textarea name="detalle" value={formData.detalle} onChange={handleInputChange} rows={4} placeholder="Información adicional, notas especiales, configuraciones particulares..." style={{ width: '100%', padding: '10px', border: '2px solid #dee2e6', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }} />
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '30px' }}>
          <Link href="/sites-v1" style={{ padding: '12px 24px', backgroundColor: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '16px' }}>Cancelar</Link>
          <button type="submit" disabled={loading} style={{ padding: '12px 24px', backgroundColor: loading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{loading ? '🔄 Creando Site...' : '✅ Crear Site V1'}</button>
        </div>
      </form>
    </div>
        );
    }