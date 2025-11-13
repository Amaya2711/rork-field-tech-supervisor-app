'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { googleMapsService } from '@/lib/googleMapsService';
import { useSearchParams } from 'next/navigation';

// Tipos básicos
type Punto = {
  id: number | string;
  codigo: string;
  nombre: string | null;
  region: string | null;
  latitud: number | null;
  longitud: number | null;
  tipo: 'site' | 'cuadrilla' | 'ticket';
  estadoTicket?: string | null;
  estado?: string;
  categoria?: string | null;
  categoriaCuadrilla?: 'A' | 'B' | 'C' | null;
  activo?: boolean;
  ticket_source?: string | null;
};

// Tipos para APIs de Google
interface RouteResponse {
  routes: {
    legs: {
      duration: { value: number; text: string };
      distance: { value: number; text: string };
      steps: any[];
    }[];
    polyline: { encodedPolyline: string };
  }[];
}

interface PlaceSearchResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address: string;
}

export default function GoogleMap() {
  // Referencias del mapa
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routesRef = useRef<google.maps.DirectionsRenderer[]>([]);
  
  // Estados básicos
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedEstado, setSelectedEstado] = useState<string>('');
  const [estadosCatalogo, setEstadosCatalogo] = useState<any[]>([]);
  const [searchRadius, setSearchRadius] = useState<number>(20);
  
  // Estados de datos
  const [sites, setSites] = useState<Punto[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Punto[]>([]);
  const [tickets, setTickets] = useState<Punto[]>([]);
  
  // Estados de visibilidad
  const [showSites, setShowSites] = useState(false);
  const [showCuadrillas, setShowCuadrillas] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  
  // Estados de carga
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingCuadrillas, setLoadingCuadrillas] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);

  // Debug de variables de entorno
  console.log('🔍 INIT: Verificando variables de entorno al cargar componente');
  console.log('🌐 Entorno:', typeof window !== 'undefined' ? window.location.hostname : 'server');
  console.log('API Key presente:', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  console.log('API Key valor:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.substring(0, 15) + '...' || 'undefined');
  console.log('Supabase URL presente:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('🔍 TODAS las variables NEXT_PUBLIC:', Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC')));
  
  // Detectar si estamos en producción sin variables configuradas
  const isProduction = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') || 
    window.location.hostname.includes('netlify.app') ||
    window.location.hostname !== 'localhost'
  );
  
  if (isProduction && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ PRODUCCIÓN: Variables de entorno no configuradas en plataforma de despliegue');
  }
  
  // Estados loaded
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [cuadrillasLoaded, setCuadrillasLoaded] = useState(false);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  
  // Totales
  const [totals, setTotals] = useState({ sites: 0, cuads: 0, tickets: 0, total: 0 });
  
  // Estados de rutas y búsquedas
  const [selectedTicket, setSelectedTicket] = useState<Punto | null>(null);
  const [calculatingRoutes, setCalculatingRoutes] = useState(false);
  const [routeResults, setRouteResults] = useState<any[]>([]);
  
  // Estados para búsqueda de cuadrillas
  const [searchCuadrilla, setSearchCuadrilla] = useState<string>('');
  const [filteredCuadrillas, setFilteredCuadrillas] = useState<Punto[]>([]);
  const [selectedCuadrilla, setSelectedCuadrilla] = useState<Punto | null>(null);

  // Estados para tracking de ruta
  const [rutaActiva, setRutaActiva] = useState(false);
  const [cuadrillaSeleccionadaParaRuta, setCuadrillaSeleccionadaParaRuta] = useState<Punto | null>(null);
  const rutaIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estados para actualización automática
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filtros activos
  const [filtrosActivos, setFiltrosActivos] = useState<{
    region: string;
    estado: string;
  }>({
    region: '',
    estado: ''
  });

  // Inicializar Google Maps usando el método moderno
  useEffect(() => {
    const initializeGoogleMaps = async () => {
      try {
        console.log('🔄 Inicializando Google Maps...');
        console.log('🔍 Verificando API Key:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Encontrada' : 'No encontrada');
        
        // Fallback para desarrollo si no se encuentra la API Key en variables de entorno
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBmtiE0jWFGUFAZXoBgF3XyXmBmJit6m6U';
        
        if (!apiKey || apiKey === 'undefined') {
          console.error('❌ Google Maps API Key no encontrada en variables de entorno');
          console.error('📋 Variables disponibles:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));
          console.error('🌐 Entorno actual:', window.location.hostname);
          setApiKeyError(true);
          return;
        }
        
        console.log('✅ Usando API Key:', apiKey.substring(0, 15) + '...');
        
        console.log('📦 Cargando Google Maps API...');
        
        // Crear script dinámicamente para evitar problemas del loader
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&v=weekly`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('🗺️ Creando instancia de mapa...');
          
          // Verificar que Google Maps esté disponible
          if (typeof google === 'undefined') {
            console.error('❌ Google Maps no está disponible después de cargar el script');
            return;
          }
          
          if (mapRef.current && !mapInstanceRef.current) {
            try {
              const map = new google.maps.Map(mapRef.current, {
                center: { lat: -12.0464, lng: -77.0428 }, // Lima, Perú
                zoom: 10,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                  }
                ]
              });
              
              mapInstanceRef.current = map;
              setMapLoaded(true);
              console.log('✅ Google Maps inicializado correctamente');
              
              // Añadir listener para cuando el mapa esté listo
              map.addListener('idle', () => {
                console.log('🎯 Mapa listo para interacción');
              });
              
              // La función calculateRoutes se define en un useEffect separado
              
            } catch (error) {
              console.error('❌ Error creando instancia de Google Maps:', error);
            }
          } else {
            console.log('⚠️ MapRef no está disponible o el mapa ya está inicializado');
          }
        };
        
        script.onerror = (error) => {
          console.error('❌ Error cargando Google Maps script:', error);
        };
        
        // Solo añadir si no existe ya
        if (!document.querySelector(`script[src*="maps.googleapis.com"]`)) {
          document.head.appendChild(script);
        }
        
      } catch (error) {
        console.error('❌ Error inicializando Google Maps:', error);
      }
    };

    initializeGoogleMaps();
  }, []);

  // Función de prueba para verificar conexión a Supabase
  const testSupabaseConnection = async () => {
    try {
      console.log('🔍 Probando conexión directa a Supabase...');
      
      // Probar conexión con consultas simples
      const { data: testCuadrillas, error: testErrorC } = await supabase
        .from('cuadrillas_v1')
        .select('id')
        .limit(5);
      
      if (testErrorC) {
        console.error('❌ Error consultando cuadrillas_v1:', testErrorC);
      } else {
        console.log('✅ Conexión OK. Primeras cuadrillas encontradas:', testCuadrillas?.length || 0);
      }
      
      // Probar también sites_v1
      const { data: testSites, error: testErrorS } = await supabase
        .from('sites_v1')
        .select('id')
        .limit(5);
        
      if (testErrorS) {
        console.error('❌ Error consultando sites_v1:', testErrorS);
      } else {
        console.log('✅ Sites encontrados:', testSites?.length || 0);
      }
      
    } catch (error) {
      console.error('❌ Error general en conexión:', error);
    }
  };

  // Cargar estados desde catalogo_estados
  useEffect(() => {
    const loadEstados = async () => {
      try {
        console.log('🔄 Cargando TODOS los estados desde catalogo_estados...');
        
        // Primero probar la conexión
        await testSupabaseConnection();
        
        const { data, error } = await supabase
          .from('catalogo_estados')
          .select('codigo, nombre, descripcion')
          .order('codigo');
        
        if (!error && data) {
          setEstadosCatalogo(data);
          console.log('✅ TODOS los estados del catálogo cargados:', data.length, 'estados');
          console.log('Estados disponibles (incluye activos e inactivos):', data.map(e => `${e.codigo}-${e.nombre}`).join(', '));
        } else {
          console.log('⚠️ Error cargando estados del catálogo, usando fallback:', error?.message);
          const fallbackEstados = [
            { codigo: 1, nombre: 'NUEVO', descripcion: 'Ticket recién creado' },
            { codigo: 2, nombre: 'EN_PROCESO', descripcion: 'Ticket en proceso' },
            { codigo: 3, nombre: 'RESUELTO', descripcion: 'Ticket completamente resuelto' },
            { codigo: 4, nombre: 'CERRADO', descripcion: 'Ticket cerrado' },
            { codigo: 5, nombre: 'CANCELADO', descripcion: 'Ticket cancelado' }
          ];
          setEstadosCatalogo(fallbackEstados);
          console.log('📝 Usando estados fallback:', fallbackEstados.map(e => e.nombre).join(', '));
        }
      } catch (err) {
        console.error('❌ Error cargando estados:', err);
      }
    };
    
    loadEstados();
  }, []);

  // Funciones auxiliares para Google Maps
  const calculateSimpleDistance = (
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Función para calcular ruta real usando Google Routes API (COMPUTE ROUTES)
  const calculateRealRouteWithGoogleAPI = async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<{
    duration: number; // minutos
    distance: number; // km
    polyline: string;
    legs: any[];
  } | null> => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBmtiE0jWFGUFAZXoBgF3XyXmBmJit6m6U';
      
      if (!apiKey || apiKey === 'undefined') {
        console.error('❌ Google Maps API Key no encontrada');
        return null;
      }

      console.log(`🔗 Llamando a Google Routes API desde (${origin.lat}, ${origin.lng}) a (${destination.lat}, ${destination.lng})`);

      // Estructura de request para Google Routes API v2
      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: true
        },
        languageCode: "es",
        units: "METRIC"
      };

      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Google Routes API Error:', response.status, response.statusText, errorText);
        return null;
      }

      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        console.error('❌ No se encontraron rutas en la respuesta');
        return null;
      }

      const route = data.routes[0];
      
      // Parsear duración (formato: "123s")
      const durationMatch = route.duration?.match(/(\d+)s/);
      const durationSeconds = durationMatch ? parseInt(durationMatch[1]) : 0;
      const durationMinutes = durationSeconds / 60;

      // Distancia en kilómetros
      const distanceKm = route.distanceMeters / 1000;

      console.log(`✅ Ruta Google API: ${durationMinutes.toFixed(1)} min, ${distanceKm.toFixed(2)} km`);

      return {
        duration: durationMinutes,
        distance: distanceKm,
        polyline: route.polyline.encodedPolyline,
        legs: route.legs || []
      };

    } catch (error) {
      console.error('❌ Error en Google Routes API:', error);
      return null;
    }
  };

  // Función para obtener colores por categoría
  const getCategoriaColors = (categoria: 'A' | 'B' | 'C' | null | undefined) => {
    switch (categoria) {
      case 'A':
        return { color: '#007bff', fillColor: '#007bff', icon: 'blue' }; // Azul
      case 'B':
        return { color: '#28a745', fillColor: '#28a745', icon: 'green' }; // Verde  
      case 'C':
        return { color: '#9b59b6', fillColor: '#9b59b6', icon: 'purple' }; // Morado
      default:
        return { color: '#dc3545', fillColor: '#dc3545', icon: 'red' }; // Rojo por defecto
    }
  };

  // Función para registrar ubicación en CUADRILLA_RUTA
  const registrarUbicacionRuta = async (cuadrilla: Punto) => {
    try {
      const now = new Date();
      const fecha = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hora = now.toTimeString().split(' ')[0]; // HH:MM:SS
      
      console.log(`📍 Registrando ubicación de cuadrilla ${cuadrilla.codigo} en CUADRILLA_RUTA`);
      
      const { error } = await supabase
        .from('CUADRILLA_RUTA')
        .insert({
          cuadrilla_id: cuadrilla.id,
          fecha: fecha,
          hora: hora,
          latitud: cuadrilla.latitud,
          longitud: cuadrilla.longitud
        });

      if (error) {
        console.error('❌ Error registrando ubicación en CUADRILLA_RUTA:', error);
      } else {
        console.log(`✅ Ubicación registrada: ${cuadrilla.codigo} (${cuadrilla.latitud}, ${cuadrilla.longitud})`);
      }
    } catch (error) {
      console.error('❌ Error en registrarUbicacionRuta:', error);
    }
  };

  // Función para iniciar tracking de ruta
  const iniciarRuta = (cuadrilla: Punto) => {
    if (rutaActiva) {
      console.log('⚠️ Ya hay una ruta activa. Deteniendo ruta anterior...');
      detenerRuta();
    }

    console.log(`🚀 Iniciando tracking de ruta para cuadrilla ${cuadrilla.codigo}`);
    setRutaActiva(true);
    setCuadrillaSeleccionadaParaRuta(cuadrilla);

    // Registrar ubicación inicial
    registrarUbicacionRuta(cuadrilla);

    // Configurar intervalo para registrar cada 5 segundos
    rutaIntervalRef.current = setInterval(() => {
      // Buscar la cuadrilla actualizada del estado para obtener coordenadas más recientes
      const cuadrillaActualizada = cuadrillas.find(c => c.id === cuadrilla.id);
      if (cuadrillaActualizada) {
        registrarUbicacionRuta(cuadrillaActualizada);
      } else {
        registrarUbicacionRuta(cuadrilla);
      }
    }, 5000);

    console.log(`⏱️ Tracking iniciado: registrando ubicación cada 5 segundos`);
  };

  // Función para detener tracking de ruta
  const detenerRuta = () => {
    if (rutaIntervalRef.current) {
      clearInterval(rutaIntervalRef.current);
      rutaIntervalRef.current = null;
    }

    console.log(`🛑 Tracking de ruta detenido para cuadrilla ${cuadrillaSeleccionadaParaRuta?.codigo}`);
    setRutaActiva(false);
    setCuadrillaSeleccionadaParaRuta(null);
  };

  // Regiones disponibles
  const regions = ['NORTE', 'CENTRO', 'SUR', 'LIMA'];

  // Función para cargar datos con paginación
  async function fetchAll<T>(table: string, select: string) {
    console.log(`📊 Consultando tabla: ${table} con campos: ${select}`);
    const BATCH_SIZE = 1000;
    let allData: T[] = [];
    let from = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(from, from + BATCH_SIZE - 1);
      
      if (error) {
        console.error(`Error consultando ${table}:`, error);
        break;
      }
      
      if (!data || data.length === 0) break;
      
      allData = [...allData, ...data as T[]];
      
      if (data.length < BATCH_SIZE) break;
      
      from += BATCH_SIZE;
    }
    
    console.log(`✅ ${table}: ${allData.length} registros obtenidos`);
    return allData;
  }

  // Cargar Sites
  const loadSites = async () => {
    if (sitesLoaded || loadingSites) return;
    setLoadingSites(true);
    try {
      console.log('🔄 Cargando sites...');
      
      const { data: sitesRaw, error: sitesError } = await supabase
        .from('sites_v1')
        .select('id, codigo, site, region, latitud, longitud');
      
      if (sitesError) {
        console.error('❌ Error en consulta de sites:', sitesError);
        return;
      }
      
      console.log(`📋 Sites obtenidos de la DB: ${sitesRaw?.length || 0}`);
      
      if (!sitesRaw || sitesRaw.length === 0) {
        console.log('⚠️ No se encontraron sites en la base de datos');
        setSites([]);
        setSitesLoaded(true);
        return;
      }
      
      const sitesPoints: Punto[] = sitesRaw
        .filter(s => s.latitud !== null && s.longitud !== null && 
                    typeof s.latitud === 'number' && typeof s.longitud === 'number')
        .map((s) => ({
          id: s.id,
          codigo: s.codigo || '',
          nombre: s.site,
          region: s.region,
          latitud: s.latitud,
          longitud: s.longitud,
          tipo: 'site' as const,
        }));
        
      setSites(sitesPoints);
      setSitesLoaded(true);
      console.log(`✅ Sites cargados: ${sitesPoints.length} con coordenadas válidas`);
      
    } catch (e) {
      console.error('❌ Error cargando sites:', e);
    } finally {
      setLoadingSites(false);
    }
  };

  // Cargar Cuadrillas
  const loadCuadrillas = async () => {
    if (cuadrillasLoaded || loadingCuadrillas) return;
    setLoadingCuadrillas(true);
    try {
      console.log('🔄 Cargando cuadrillas...');
      
      // Verificar primero qué columnas existen en cuadrillas
      console.log('🔍 Verificando estructura de cuadrillas...');
      const { data: sampleCuadrilla, error: sampleError } = await supabase
        .from('cuadrillas')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ Error verificando estructura de cuadrillas:', sampleError);
        return;
      }
      
      console.log('🔍 Estructura de cuadrillas:', sampleCuadrilla?.[0] ? Object.keys(sampleCuadrilla[0]) : 'No data');
      
      // Consulta directa sin fetchAll - usando solo campos disponibles
      console.log('📊 Consultando todas las cuadrillas...');
      const { data: cuadrillasRaw, error: cuadrillasError } = await supabase
        .from('cuadrillas')
        .select('id, codigo, nombre, latitud, longitud, activo, categoria, estado, skill_1, skill_2, skill_3');
      
      if (cuadrillasError) {
        console.error('❌ Error en consulta de cuadrillas:', cuadrillasError);
        return;
      }
      
      console.log(`📋 Cuadrillas obtenidas de la DB: ${cuadrillasRaw?.length || 0}`);
      
      if (!cuadrillasRaw || cuadrillasRaw.length === 0) {
        console.log('⚠️ No se encontraron cuadrillas en la base de datos');
        setCuadrillas([]);
        setCuadrillasLoaded(true);
        return;
      }
      
      // Procesar cuadrillas
      const cuadrillasConCoordenadas = cuadrillasRaw.filter(c => {
        const hasCoords = c.latitud !== null && c.longitud !== null && 
                         typeof c.latitud === 'number' && typeof c.longitud === 'number';
        if (!hasCoords) {
          console.log(`⚠️ Cuadrilla ${c.codigo} sin coordenadas válidas:`, { lat: c.latitud, lng: c.longitud });
        } else {
          console.log(`📍 Cuadrilla ${c.codigo} con coordenadas:`, { lat: c.latitud, lng: c.longitud });
        }
        return hasCoords;
      });
      
      console.log(`📍 Cuadrillas con coordenadas válidas: ${cuadrillasConCoordenadas.length}/${cuadrillasRaw.length}`);
      
      const cuadrillasPoints: Punto[] = cuadrillasConCoordenadas.map((c) => ({
  id: c.id,
  codigo: c.codigo || '',
  nombre: c.nombre || '',
  region: null, // La tabla cuadrillas no tiene columna region
  latitud: c.latitud,
  longitud: c.longitud,
  tipo: 'cuadrilla' as const,
  activo: c.activo,
  categoriaCuadrilla: c.categoria as 'A' | 'B' | 'C' | null,
  estado: c.estado || ''
      }));
      
      setCuadrillas(cuadrillasPoints);
      setCuadrillasLoaded(true);
      console.log(`✅ Cuadrillas cargadas exitosamente: ${cuadrillasPoints.length}`);
      
      // Mostrar algunas cuadrillas de ejemplo
      if (cuadrillasPoints.length > 0) {
        console.log('📋 Ejemplos de cuadrillas cargadas:', cuadrillasPoints.slice(0, 3).map(c => ({
          codigo: c.codigo,
          nombre: c.nombre,
          categoria: c.categoriaCuadrilla,
          activo: c.activo,
          lat: c.latitud,
          lng: c.longitud
        })));
        
        console.log(`🗺️ RESUMEN: ${cuadrillasPoints.length} cuadrillas con ubicaciones válidas serán mostradas en el mapa`);
      } else {
        console.warn('⚠️ No hay cuadrillas con coordenadas válidas para mostrar en el mapa');
      }
      
    } catch (e) {
      console.error('❌ Error cargando cuadrillas:', e);
    } finally {
      setLoadingCuadrillas(false);
    }
  };

  // Actualizar coordenadas de cuadrillas (para tiempo real)
  const updateCuadrillasPositions = async () => {
    if (!cuadrillasLoaded || !showCuadrillas) return;
    
    try {
      console.log('🔄 Actualizando posiciones de cuadrillas...');
      
      // Obtener solo las coordenadas actualizadas de las cuadrillas
      const { data: updatedCoords, error } = await supabase
        .from('cuadrillas_v1')
        .select('id, codigo, latitud, longitud')
        .not('latitud', 'is', null)
        .not('longitud', 'is', null);
      
      if (error) {
        console.error('❌ Error actualizando coordenadas:', error);
        return;
      }
      
      if (!updatedCoords || updatedCoords.length === 0) {
        console.log('⚠️ No se encontraron coordenadas actualizadas');
        return;
      }
      
      // Actualizar las coordenadas en el estado de cuadrillas
      setCuadrillas(prevCuadrillas => {
        return prevCuadrillas.map(cuadrilla => {
          const updatedCoord = updatedCoords.find(coord => coord.id === cuadrilla.id);
          if (updatedCoord && (
            updatedCoord.latitud !== cuadrilla.latitud || 
            updatedCoord.longitud !== cuadrilla.longitud
          )) {
            console.log(`📍 Actualizando ubicación de cuadrilla ${cuadrilla.codigo}:`);
            console.log(`   Anterior: (${cuadrilla.latitud}, ${cuadrilla.longitud})`);
            console.log(`   Nueva: (${updatedCoord.latitud}, ${updatedCoord.longitud})`);
            return {
              ...cuadrilla,
              latitud: updatedCoord.latitud,
              longitud: updatedCoord.longitud
            };
          }
          return cuadrilla;
        });
      });
      
      setLastUpdate(new Date());
      console.log(`✅ Actualización completada: ${updatedCoords.length} cuadrillas verificadas`);
      console.log('🗺️ Las ubicaciones de las cuadrillas en el mapa reflejan los valores actuales de latitud y longitud de la base de datos');
      
    } catch (e) {
      console.error('❌ Error actualizando posiciones de cuadrillas:', e);
    }
  };

  // Cargar Tickets
  const loadTickets = async (estadoFiltro: string = '') => {
    if (ticketsLoaded || loadingTickets) return;
    setLoadingTickets(true);
    try {
      console.log('🔄 Cargando tickets...');
      
      // Verificar primero qué columnas existen en tickets_v1
      let ticketsQuery = supabase
        .from('tickets_v1')
        .select('*')
        .limit(1);
      
      const { data: sampleTicket, error: sampleError } = await ticketsQuery;
      
      if (sampleError) {
        console.error('❌ Error verificando estructura de tickets:', sampleError);
        return;
      }
      
      console.log('🔍 Estructura de tickets_v1:', sampleTicket?.[0] ? Object.keys(sampleTicket[0]) : 'No data');
      
      // Consulta principal de tickets con campos básicos
      let mainQuery = supabase
  .from('tickets_v1')
  .select('id, site_id, site_name, estado, ticket_source');
      
      // Aplicar filtro de estado si se proporciona
      if (estadoFiltro && estadoFiltro !== '') {
        mainQuery = mainQuery.eq('estado', estadoFiltro);
        console.log(`🔍 Aplicando filtro de estado: ${estadoFiltro}`);
      }
      
      const { data: ticketsRaw, error: ticketsError } = await mainQuery;
      
      if (ticketsError) {
        console.error('❌ Error en consulta de tickets:', ticketsError);
        return;
      }
      
      if (!ticketsRaw || ticketsRaw.length === 0) {
        console.log('⚠️ No se encontraron tickets');
        setTickets([]);
        setTicketsLoaded(true);
        return;
      }
      
      // Obtener coordenadas de sites para los tickets encontrados
      const siteIds = ticketsRaw.map(t => t.site_id).filter(Boolean);
      
      if (siteIds.length === 0) {
        console.log('⚠️ No se encontraron site_ids válidos');
        setTickets([]);
        setTicketsLoaded(true);
        return;
      }
      
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites_v1')
        .select('codigo, region, latitud, longitud')
        .in('codigo', siteIds);
      
      if (sitesError) {
        console.error('❌ Error obteniendo coordenadas de sites:', sitesError);
        return;
      }
      
      // Crear mapa de coordenadas y regiones
      const sitesMap = new Map();
      (sitesData || []).forEach(site => {
        if (site.latitud !== null && site.longitud !== null) {
          sitesMap.set(site.codigo, {
            lat: site.latitud,
            lng: site.longitud,
            region: site.region
          });
        }
      });
      
      // Combinar tickets con coordenadas
      const ticketsPoints: Punto[] = ticketsRaw
        .map((t) => {
          const siteInfo = sitesMap.get(t.site_id);
          if (!siteInfo) return null;
          return {
            id: t.id,
            codigo: t.site_id || '',
            nombre: t.site_name,
            region: siteInfo.region,
            latitud: siteInfo.lat,
            longitud: siteInfo.lng,
            tipo: 'ticket' as const,
            estadoTicket: t.estado,
            ticket_source: t.ticket_source
          };
        })
        .filter(t => t !== null) as Punto[];
        
      setTickets(ticketsPoints);
      setTicketsLoaded(true);
      console.log(`✅ Tickets cargados: ${ticketsPoints.length} con coordenadas válidas`);
      
    } catch (e) {
      console.error('❌ Error cargando tickets:', e);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Calcular totales
  useEffect(() => {
    const newTotals = {
      sites: sites.length,
      cuads: cuadrillas.length,
      tickets: tickets.length,
      total: sites.length + cuadrillas.length + tickets.length
    };
    setTotals(newTotals);
  }, [sites, cuadrillas, tickets]);

  // Crear marcadores de Google Maps
  const createMarkerIcon = (tipo: 'site' | 'cuadrilla' | 'ticket', categoria?: 'A' | 'B' | 'C' | null, estado?: string) => {
  let color = '#dc3545'; // Rojo por defecto
    if (tipo === 'site') {
      color = '#28a745'; // Verde
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: color,
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 2
      };
    } else if (tipo === 'cuadrilla') {
      // Si la cuadrilla está ASIGNADA, color rojo
      if (estado === 'ASIGNADO') {
        color = '#dc3545';
      } else {
        const categoriaColors = getCategoriaColors(categoria);
        color = categoriaColors.fillColor;
      }
      // Icono de vehículo/camioneta para cuadrillas
      return {
        path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
        scale: 1.5,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        anchor: new google.maps.Point(12, 12),
        labelOrigin: new google.maps.Point(12, 5)
      };
    } else if (tipo === 'ticket') {
      color = '#ffc107'; // Amarillo
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: color,
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 2
      };
    }
    // Fallback para otros tipos
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: '#ffffff',
      strokeWeight: 2
    };
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current) return;
    
    clearMarkers();
    
    // Añadir marcadores de sites
    if (showSites) {
      visibleSites.forEach(site => {
        if (site.latitud !== null && site.longitud !== null) {
          const marker = new google.maps.Marker({
            position: { lat: site.latitud, lng: site.longitud },
            map: mapInstanceRef.current,
            title: `${site.codigo} - ${site.nombre}`,
            icon: createMarkerIcon('site')
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div>
                <h4>📡 SITE</h4>
                <p><strong>Código:</strong> ${site.codigo}</p>
                <p><strong>Nombre:</strong> ${site.nombre || 'N/A'}</p>
                <p><strong>Región:</strong> ${site.region || 'N/A'}</p>
                <p><strong>Coordenadas:</strong> ${site.latitud}, ${site.longitud}</p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(mapInstanceRef.current, marker);
          });

          markersRef.current.push(marker);
        }
      });
    }

    // Añadir marcadores de cuadrillas
    if (showCuadrillas) {
      visibleCuadrillas.forEach(cuadrilla => {
        if (cuadrilla.latitud !== null && cuadrilla.longitud !== null) {
          const marker = new google.maps.Marker({
            position: { lat: cuadrilla.latitud, lng: cuadrilla.longitud },
            map: mapInstanceRef.current,
            title: `${cuadrilla.codigo} - ${cuadrilla.nombre}`,
            icon: createMarkerIcon('cuadrilla', cuadrilla.categoriaCuadrilla, cuadrilla.estado)
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div>
                <h4>👥 CUADRILLA</h4>
                <p><strong>Código:</strong> ${cuadrilla.codigo}</p>
                <p><strong>Nombre:</strong> ${cuadrilla.nombre || 'N/A'}</p>
                <p><strong>Categoría:</strong> ${cuadrilla.categoriaCuadrilla || 'No definida'}</p>
                <p><strong>Estado:</strong> ${cuadrilla.activo ? '🟢 Activo' : '🔴 Inactivo'}</p>
                <p><strong>📍 Ubicación Actual:</strong></p>
                <p style="margin-left: 15px;">Latitud: ${cuadrilla.latitud}</p>
                <p style="margin-left: 15px;">Longitud: ${cuadrilla.longitud}</p>
                <p style="font-size: 0.8em; color: #666;"><em>Posición obtenida desde base de datos</em></p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(mapInstanceRef.current, marker);
          });

          markersRef.current.push(marker);
        }
      });
    }

    // Añadir marcadores de tickets
    if (showTickets) {
      visibleTickets.forEach(ticket => {
        if (ticket.latitud !== null && ticket.longitud !== null) {
          const marker = new google.maps.Marker({
            position: { lat: ticket.latitud, lng: ticket.longitud },
            map: mapInstanceRef.current,
            title: `${ticket.codigo} - ${ticket.nombre}`,
            icon: createMarkerIcon('ticket')
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div>
                <h4>🎫 TICKET</h4>
                <p><strong>Código:</strong> ${ticket.codigo}</p>
                <p><strong>Nombre:</strong> ${ticket.nombre || 'N/A'}</p>
                <p><strong>Región:</strong> ${ticket.region || 'N/A'}</p>
                <p><strong>Estado:</strong> ${ticket.estadoTicket || 'N/A'}</p>
                <p><strong>Coordenadas:</strong> ${ticket.latitud}, ${ticket.longitud}</p>
                <p><strong>ticket_source:</strong> ${ticket.ticket_source || 'N/A'}</p>
                <button onclick="window.calculateRoutes('${ticket.id}')" 
                        style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin-top: 8px; cursor: pointer;">
                  🛣️ Calcular Rutas
                </button>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(mapInstanceRef.current, marker);
            setSelectedTicket(ticket);
          });

          markersRef.current.push(marker);
        }
      });
    }

    console.log(`🗺️ Marcadores actualizados: ${markersRef.current.length} en el mapa`);
  };

  // Función para calcular rutas reales con Google Routes API (COMPUTE ROUTES)
  const calculateRoutesToCuadrillas = async (ticket: Punto) => {
    if (!ticket.latitud || !ticket.longitud) return;
    
    setCalculatingRoutes(true);
    const results: Array<{
      cuadrilla: Punto;
      duration: number;
      distance: number;
      polyline?: string;
      route?: any;
    }> = [];
    
    try {
      console.log(`🛣️ Calculando rutas reales desde ticket ${ticket.codigo} (Categoría: ${ticket.categoria || 'Sin categoría'}) usando Google COMPUTE ROUTES...`);
      
      // PASO 1: Filtrar cuadrillas por CATEGORÍA PRIMERO
      const ticketCategoria = ticket.categoria;
      console.log(`🎯 Buscando cuadrillas de categoría: ${ticketCategoria || 'Sin categoría'}`);
      
      let cuadrillasPorCategoria = visibleCuadrillas.filter(c => {
        if (!c.latitud || !c.longitud) return false;
        
        // Filtrar por categoría del ticket
        const matchCategoria = ticketCategoria ? c.categoria === ticketCategoria : true;
        
        return matchCategoria;
      });
      
      console.log(`📊 Cuadrillas encontradas con categoría ${ticketCategoria}: ${cuadrillasPorCategoria.length}`);
      
      // Si no hay cuadrillas de la misma categoría, usar todas las disponibles
      if (cuadrillasPorCategoria.length === 0) {
        console.log(`⚠️ No se encontraron cuadrillas de categoría ${ticketCategoria}, usando todas las cuadrillas disponibles`);
        cuadrillasPorCategoria = visibleCuadrillas.filter(c => c.latitud && c.longitud);
      }
      
      // PASO 2: Filtrar por rango de distancia
      const cuadrillasEnRango = cuadrillasPorCategoria.filter(c => {
        const distance = calculateSimpleDistance(
          { lat: ticket.latitud!, lng: ticket.longitud! },
          { lat: c.latitud!, lng: c.longitud! }
        );
        
        return distance <= searchRadius;
      });
      
      console.log(`🎯 Cuadrillas de categoría ${ticketCategoria} en rango de ${searchRadius}km: ${cuadrillasEnRango.length}`);
      
      // PASO 3: Ordenar por distancia y limitar a las 5 más cercanas
      const cuadrillasLimitadas = cuadrillasEnRango
        .map(c => ({
          ...c,
          distanceSimple: calculateSimpleDistance(
            { lat: ticket.latitud!, lng: ticket.longitud! },
            { lat: c.latitud!, lng: c.longitud! }
          )
        }))
        .sort((a, b) => a.distanceSimple - b.distanceSimple)
        .slice(0, 5);
      
      console.log(`🔄 Calculando rutas reales para las ${cuadrillasLimitadas.length} cuadrillas más cercanas de categoría ${ticketCategoria}:`);
      cuadrillasLimitadas.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.codigo} - Categoría: ${c.categoria} - Distancia: ${c.distanceSimple.toFixed(2)}km`);
      });
      
      // Calcular ruta real para cada cuadrilla usando Google Routes API
      for (const cuadrilla of cuadrillasLimitadas) {
        try {
          console.log(`📍 Calculando ruta a cuadrilla ${cuadrilla.codigo}...`);
          
          const routeResult = await calculateRealRouteWithGoogleAPI(
            { lat: ticket.latitud!, lng: ticket.longitud! },
            { lat: cuadrilla.latitud!, lng: cuadrilla.longitud! }
          );
          
          if (routeResult) {
            results.push({
              cuadrilla: cuadrilla,
              duration: routeResult.duration,
              distance: routeResult.distance,
              polyline: routeResult.polyline,
              route: routeResult
            });
            
            console.log(`✅ Ruta calculada para ${cuadrilla.codigo}: ${routeResult.duration.toFixed(1)} min, ${routeResult.distance.toFixed(2)} km`);
          } else {
            // Si falla la API, usar cálculo simple como fallback
            const distance = cuadrilla.distanceSimple;
            const estimatedDuration = (distance / 30) * 60; // 30 km/h promedio
            
            results.push({
              cuadrilla: cuadrilla,
              duration: estimatedDuration,
              distance: distance
            });
            
            console.log(`⚠️ Fallback para ${cuadrilla.codigo}: ${estimatedDuration.toFixed(1)} min, ${distance.toFixed(2)} km`);
          }
          
        } catch (error) {
          console.error(`❌ Error calculando ruta a cuadrilla ${cuadrilla.codigo}:`, error);
        }
      }
      
      // Ordenar por tiempo de viaje
      results.sort((a, b) => a.duration - b.duration);
      
      setRouteResults(results);
      console.log(`✅ Total rutas calculadas: ${results.length}`);
      
      // Mostrar rutas reales en el mapa
      displayRealRoutesOnMap(ticket, results);
      
    } catch (error) {
      console.error('❌ Error en cálculo de rutas:', error);
    } finally {
      setCalculatingRoutes(false);
    }
  };

  // Actualizar función global cuando cambien los datos
  useEffect(() => {
    if (mapLoaded) {
      (window as any).calculateRoutes = async (ticketId: string) => {
        console.log(`🎯 Calculando rutas para ticket ID: ${ticketId}`);
        
        // Buscar el ticket por ID en todos los tickets cargados
        const ticket = tickets.find(t => t.id.toString() === ticketId.toString());
        if (!ticket) {
          console.error('❌ Ticket no encontrado:', ticketId);
          console.log('Tickets disponibles:', tickets.map(t => t.id));
          return;
        }
        
        console.log('✅ Ticket encontrado:', ticket);
        
        // Usar la nueva función de rutas reales
        await calculateRoutesToCuadrillas(ticket);
      };
    }
  }, [tickets, cuadrillas, mapLoaded]);
  
  // Función para decodificar polyline de Google
  const decodeGooglePolyline = (encoded: string): Array<{ lat: number; lng: number }> => {
    const points: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        lat: lat / 1e5,
        lng: lng / 1e5
      });
    }

    return points;
  };

  // Mostrar rutas reales en el mapa usando polylines de Google Routes API
  const displayRealRoutesOnMap = (
    ticket: Punto, 
    results: Array<{
      cuadrilla: Punto; 
      duration: number; 
      distance: number; 
      polyline?: string;
    }>
  ) => {
    if (!mapInstanceRef.current) return;
    
    // Limpiar rutas anteriores
    routesRef.current.forEach(line => line.setMap(null));
    routesRef.current = [];
    
    console.log(`🗺️ Mostrando ${results.length} rutas en el mapa...`);
    
    // Añadir nuevas rutas reales
    results.slice(0, 3).forEach((result, index) => {
      // Colores por prioridad: Verde (mejor), Amarillo (segunda), Rojo (tercera)
      const colors = [
        { color: '#28a745', weight: 5 }, // Verde - Mejor ruta
        { color: '#ffc107', weight: 4 }, // Amarillo - Segunda opción
        { color: '#dc3545', weight: 3 }  // Rojo - Tercera opción
      ];
      
      const style = colors[index] || colors[2];
      
      if (result.polyline) {
        // Usar ruta real de Google Routes API
        try {
          const decodedPath = decodeGooglePolyline(result.polyline);
          
          const polyline = new google.maps.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: style.color,
            strokeOpacity: 0.9,
            strokeWeight: style.weight,
            map: mapInstanceRef.current
          });
          
          routesRef.current.push(polyline as any);
          
          console.log(`✅ Ruta real dibujada para ${result.cuadrilla.codigo}: ${decodedPath.length} puntos`);
          
          // Añadir marcador de información en el punto medio de la ruta
          if (decodedPath.length > 0) {
            const midIndex = Math.floor(decodedPath.length / 2);
            const midPoint = decodedPath[midIndex];
            
            const infoMarker = new google.maps.Marker({
              position: midPoint,
              map: mapInstanceRef.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: style.color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              },
              title: `${result.cuadrilla.codigo}: ${result.duration.toFixed(1)} min, ${result.distance.toFixed(2)} km`
            });
            
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="text-align: center;">
                  <div style="font-weight: bold; color: ${style.color};">
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} ${result.cuadrilla.codigo}
                  </div>
                  <div style="font-size: 12px;">
                    🏷️ Categoría: ${result.cuadrilla.categoria || 'N/A'}<br/>
                    ⏱️ ${result.duration.toFixed(1)} min<br/>
                    📏 ${result.distance.toFixed(2)} km
                  </div>
                </div>
              `
            });
            
            infoMarker.addListener('click', () => {
              infoWindow.open(mapInstanceRef.current, infoMarker);
            });
            
            routesRef.current.push(infoMarker as any);
          }
          
        } catch (error) {
          console.error(`❌ Error decodificando polyline para ${result.cuadrilla.codigo}:`, error);
          // Fallback a línea directa
          createDirectLine(ticket, result, style, index);
        }
      } else {
        // Fallback: línea directa si no hay polyline
        createDirectLine(ticket, result, style, index);
      }
    });
  };
  
  // Función auxiliar para crear línea directa (fallback)
  const createDirectLine = (
    ticket: Punto, 
    result: { cuadrilla: Punto; duration: number; distance: number; }, 
    style: { color: string; weight: number }, 
    index: number
  ) => {
    const line = new google.maps.Polyline({
      path: [
        { lat: ticket.latitud!, lng: ticket.longitud! },
        { lat: result.cuadrilla.latitud!, lng: result.cuadrilla.longitud! }
      ],
      geodesic: true,
      strokeColor: style.color,
      strokeOpacity: 0.6, // Menos opaco para indicar que es estimado
      strokeWeight: style.weight,
      map: mapInstanceRef.current,
      icons: [{
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2 },
        offset: '50%'
      }]
    });
    
    routesRef.current.push(line as any);
    console.log(`⚠️ Línea directa (fallback) para ${result.cuadrilla.codigo}`);
  };

  // Datos filtrados
  const visibleSites = sites.filter(s => 
    !filtrosActivos.region || s.region === filtrosActivos.region
  );
  
  // Las cuadrillas no tienen región, así que las mostramos todas
  const visibleCuadrillas = cuadrillas;
  
  const visibleTickets = tickets.filter(t => {
    const matchesRegion = !filtrosActivos.region || t.region === filtrosActivos.region;
    const matchesEstado = !filtrosActivos.estado || t.estadoTicket === filtrosActivos.estado;
    return matchesRegion && matchesEstado;
  });

  // Funciones para manejar checkboxes
  const handleSitesChange = (checked: boolean) => {
    setShowSites(checked);
    if (checked && !sitesLoaded) {
      loadSites();
    }
  };

  const handleCuadrillasChange = (checked: boolean) => {
    setShowCuadrillas(checked);
    if (checked && !cuadrillasLoaded) {
      loadCuadrillas();
    }
  };

  const handleTicketsChange = (checked: boolean) => {
    setShowTickets(checked);
    if (checked && !ticketsLoaded) {
      loadTickets();
    }
  };

  // Funciones para búsqueda de cuadrillas
  const handleSearchCuadrilla = (searchTerm: string) => {
    setSearchCuadrilla(searchTerm);
    
    if (!searchTerm.trim()) {
      setFilteredCuadrillas([]);
      setSelectedCuadrilla(null);
      return;
    }
    
    // Filtrar cuadrillas por nombre o código
    const filtered = cuadrillas.filter(c => {
      const matchesNombre = c.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCodigo = c.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesNombre || matchesCodigo;
    });
    
    setFilteredCuadrillas(filtered);
    
    console.log(`🔍 Búsqueda "${searchTerm}": ${filtered.length} cuadrillas encontradas`);
  };
  
  const selectCuadrilla = (cuadrilla: Punto) => {
    setSelectedCuadrilla(cuadrilla);
    
    if (mapInstanceRef.current && cuadrilla.latitud && cuadrilla.longitud) {
      // Centrar mapa en la cuadrilla seleccionada
      mapInstanceRef.current.setCenter({
        lat: cuadrilla.latitud,
        lng: cuadrilla.longitud
      });
      mapInstanceRef.current.setZoom(15); // Zoom más cercano
      
      // Limpiar marcadores anteriores de búsqueda
      markersRef.current.forEach(marker => {
        if (marker.getTitle()?.includes('🎯 SELECCIONADA')) {
          marker.setMap(null);
        }
      });
      
      // Crear marcador especial para la cuadrilla seleccionada
      const marker = new google.maps.Marker({
        position: { lat: cuadrilla.latitud, lng: cuadrilla.longitud },
        map: mapInstanceRef.current,
        title: `🎯 SELECCIONADA: ${cuadrilla.codigo}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#ff6b35" stroke="#ffffff" stroke-width="3"/>
              <circle cx="16" cy="16" r="6" fill="#ffffff"/>
              <text x="16" y="20" text-anchor="middle" fill="#ff6b35" font-size="10" font-weight="bold">📍</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        },
        animation: google.maps.Animation.BOUNCE,
        zIndex: 9999
      });
      
      // Info window para la cuadrilla seleccionada
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="text-align: center; padding: 10px;">
            <h4 style="margin: 0; color: #ff6b35;">🎯 CUADRILLA SELECCIONADA</h4>
            <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
              <div><strong>Código:</strong> ${cuadrilla.codigo}</div>
              <div><strong>Nombre:</strong> ${cuadrilla.nombre || 'N/A'}</div>
              <div><strong>Categoría:</strong> <span style="color: #007bff; font-weight: bold;">${cuadrilla.categoria || 'N/A'}</span></div>
              <div><strong>Región:</strong> ${cuadrilla.region || 'N/A'}</div>
              <div><strong>Estado:</strong> <span style="color: ${cuadrilla.estado === 'ASIGNADO' ? '#dc3545' : '#198754'}; font-weight: bold;">${cuadrilla.estado || 'N/A'}</span></div>
            </div>
            <div style="font-size: 11px; color: #666;">
              📍 ${cuadrilla.latitud}, ${cuadrilla.longitud}
            </div>
            <button id="asignar-cuadrilla-btn" style="margin-top:10px;padding:6px 16px;background:#198754;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;" ${cuadrilla.estado === 'ASIGNADO' ? 'disabled' : ''}>ASIGNAR</button>
          </div>
        `
      });
      
      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        setTimeout(() => {
          const btn = document.getElementById('asignar-cuadrilla-btn');
          if (btn) {
              btn.onclick = async () => {
                if (!selectedTicket) {
                  alert('No hay ticket seleccionado para asignar.');
                  return;
                }
                // Obtener datos
                const ticketId = selectedTicket.id;
                const cuadrillaId = cuadrilla.id;
                const fechaAsignacion = new Date().toISOString();
                // TODO: Reemplazar por usuario real si está en contexto
                const usuarioCreacion = 'sistema';
                // Insertar en CUADRILLA_TICKET_ESTADOS
                const { error: insertError } = await supabase
                  .from('cuadrilla_ticket_estados')
                  .insert({
                    ticket_id: ticketId,
                    cuadrilla_id: cuadrillaId,
                    fecha_asignacion: fechaAsignacion,
                    usuario_creacion: usuarioCreacion,
                    estado: 'ASIGNADO'
                  });
                if (insertError) {
                  alert('Error al asignar cuadrilla: ' + insertError.message);
                  return;
                }
                // Actualizar estado del ticket
                const { error: updateError } = await supabase
                  .from('tickets_v1')
                  .update({ estado: 'ASIGNADO' })
                  .eq('id', ticketId);
                if (updateError) {
                  alert('Error al actualizar estado del ticket: ' + updateError.message);
                  return;
                }
                  // Actualizar estado de la cuadrilla
                  const { error: updateCuadrillaError } = await supabase
                    .from('cuadrillas_v1')
                    .update({ estado: 'ASIGNADO' })
                    .eq('id', cuadrillaId);
                  if (updateCuadrillaError) {
                    alert('Error al actualizar estado de la cuadrilla: ' + updateCuadrillaError.message);
                    return;
                  }
                alert(`Cuadrilla asignada correctamente: ${cuadrilla.codigo}`);
              };
          }
        }, 100);
      });
      
      // Abrir automáticamente el info window
      setTimeout(() => {
        infoWindow.open(mapInstanceRef.current, marker);
        setTimeout(() => {
          const btn = document.getElementById('asignar-cuadrilla-btn');
          if (btn) {
              btn.onclick = async () => {
                if (!selectedTicket) {
                  alert('No hay ticket seleccionado para asignar.');
                  return;
                }
                // Obtener datos
                const ticketId = selectedTicket.id;
                const cuadrillaId = cuadrilla.id;
                const fechaAsignacion = new Date().toISOString();
                // TODO: Reemplazar por usuario real si está en contexto
                const usuarioCreacion = 'sistema';
                // Insertar en CUADRILLA_TICKET_ESTADOS
                const { error: insertError } = await supabase
                  .from('cuadrilla_ticket_estados')
                  .insert({
                    ticket_id: ticketId,
                    cuadrilla_id: cuadrillaId,
                    fecha_asignacion: fechaAsignacion,
                    usuario_creacion: usuarioCreacion,
                    estado: 'ASIGNADO'
                  });
                if (insertError) {
                  alert('Error al asignar cuadrilla: ' + insertError.message);
                  return;
                }
                // Actualizar estado del ticket
                const { error: updateError } = await supabase
                  .from('tickets_v1')
                  .update({ estado: 'ASIGNADO' })
                  .eq('id', ticketId);
                if (updateError) {
                  alert('Error al actualizar estado del ticket: ' + updateError.message);
                  return;
                }
                alert(`Cuadrilla asignada correctamente: ${cuadrilla.codigo}`);
              };
          }
        }, 500);
      }, 500);
      
      // Parar animación después de 3 segundos
      setTimeout(() => {
        marker.setAnimation(null);
      }, 3000);
      
      markersRef.current.push(marker);
      
      console.log(`🎯 Cuadrilla seleccionada: ${cuadrilla.codigo} - ${cuadrilla.nombre}`);
    }
    
    // Limpiar búsqueda
    setSearchCuadrilla('');
    setFilteredCuadrillas([]);
  };

  // Actualizar marcadores cuando cambien los datos o filtros
  useEffect(() => {
    if (mapLoaded && mapInstanceRef.current) {
      console.log('🔄 Actualizando marcadores del mapa...');
      console.log('Estado actual:', { 
        showSites, showCuadrillas, showTickets, 
        sitesCount: sites.length, 
        cuadrillasCount: cuadrillas.length, 
        ticketsCount: tickets.length 
      });
      updateMapMarkers();
    }
  }, [showSites, showCuadrillas, showTickets, sites, cuadrillas, tickets, filtrosActivos, mapLoaded]);

  // UseEffect para actualización automática de posiciones de cuadrillas cada 5 segundos
  useEffect(() => {
    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Solo iniciar el intervalo si la actualización automática está habilitada y las cuadrillas están cargadas
    if (autoUpdateEnabled && cuadrillasLoaded && showCuadrillas) {
      console.log('⏰ Iniciando actualización automática de cuadrillas cada 5 segundos...');
      
      // Primera actualización inmediata
      updateCuadrillasPositions();
      
      // Configurar intervalo para actualizaciones periódicas
      intervalRef.current = setInterval(() => {
        updateCuadrillasPositions();
      }, 5000); // 5 segundos
      
      console.log('✅ Actualización automática configurada');
    } else {
      console.log('⏸️ Actualización automática deshabilitada o cuadrillas no cargadas');
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        console.log('🛑 Limpiando intervalo de actualización automática');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoUpdateEnabled, cuadrillasLoaded, showCuadrillas]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Función para aplicar filtros manualmente
  const aplicarFiltros = async () => {
    setFiltrosActivos({
      region: selectedRegion,
      estado: selectedEstado
    });
    
    // Recargar tickets si hay filtro de estado
    if (selectedEstado && showTickets) {
      setTicketsLoaded(false);
      await loadTickets(selectedEstado);
    }
    
    console.log('🔍 Filtros aplicados:', { region: selectedRegion, estado: selectedEstado });
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setSelectedRegion('');
    setSelectedEstado('');
    setFiltrosActivos({
      region: '',
      estado: ''
    });
    console.log('🗑️ Filtros limpiados');
  };

  const searchParams = useSearchParams();
  const ticketIdParam = searchParams.get('ticket');

  useEffect(() => {
    if (ticketIdParam) {
      setShowCuadrillas(true);
      setShowTickets(true);
    }
  }, [ticketIdParam]);

  useEffect(() => {
    if (ticketIdParam && ticketsLoaded && tickets.length > 0) {
      const ticket = tickets.find(t => String(t.id) === String(ticketIdParam));
      if (ticket && ticket.latitud && ticket.longitud && mapInstanceRef.current) {
        setSelectedTicket(ticket);
        mapInstanceRef.current.setCenter({ lat: ticket.latitud, lng: ticket.longitud });
        mapInstanceRef.current.setZoom(15);
        // Opcional: crear marcador especial
        const marker = new google.maps.Marker({
          position: { lat: ticket.latitud, lng: ticket.longitud },
          map: mapInstanceRef.current,
          title: `Ticket ${ticket.codigo || ticket.id}`,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(40, 40)
          }
        });
        markersRef.current.push(marker);
      }
    }
  }, [ticketIdParam, ticketsLoaded, tickets]);

  return (
    <>
      {/* CSS para animaciones */}
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Panel de Control Superior */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: 15,
          borderRadius: 10,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}
      >
        <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: 16 }}>
          🗺️ Mapa Google Maps - Control
        </h3>

        {/* Fila 1: Checkboxes para mostrar/ocultar elementos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showSites}
              onChange={(e) => handleSitesChange(e.target.checked)}
            />
            <span style={{ color: '#28a745', fontWeight: 600, fontSize: 13 }}>
              📡 Sites {loadingSites ? '⏳' : ''}
            </span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showCuadrillas}
              onChange={(e) => handleCuadrillasChange(e.target.checked)}
            />
            <span style={{ color: '#6f42c1', fontWeight: 600, fontSize: 13 }}>
              👥 Cuadrillas {loadingCuadrillas ? '⏳' : ''}
            </span>
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showTickets}
              onChange={(e) => handleTicketsChange(e.target.checked)}
            />
            <span style={{ color: '#dc3545', fontWeight: 600, fontSize: 13 }}>
              🎫 Tickets {loadingTickets ? '⏳' : ''}
            </span>
          </label>
        </div>

        {/* Control de actualización automática */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 15, 
          marginBottom: 15,
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: 6,
          border: '1px solid #dee2e6'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={autoUpdateEnabled}
              onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
            />
            <span style={{ color: '#17a2b8', fontWeight: 600, fontSize: 13 }}>
              🔄 Actualización Automática (5s)
            </span>
          </label>
          
          {lastUpdate && (
            <span style={{ fontSize: 12, color: '#6c757d' }}>
              📡 Última actualización: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          
          {autoUpdateEnabled && showCuadrillas && (
            <span style={{ 
              fontSize: 11, 
              color: '#28a745', 
              backgroundColor: '#d4edda',
              padding: '2px 6px',
              borderRadius: 3,
              border: '1px solid #c3e6cb'
            }}>
              ✅ ACTIVO
            </span>
          )}
          
          {(!autoUpdateEnabled || !showCuadrillas) && (
            <span style={{ 
              fontSize: 11, 
              color: '#856404', 
              backgroundColor: '#fff3cd',
              padding: '2px 6px',
              borderRadius: 3,
              border: '1px solid #ffeaa7'
            }}>
              ⏸️ PAUSADO
            </span>
          )}
        </div>

        {/* Fila de búsqueda de cuadrillas */}
        <div style={{ marginBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
              🔍 Buscar Cuadrilla:
            </label>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <input
                type="text"
                value={searchCuadrilla}
                onChange={(e) => handleSearchCuadrilla(e.target.value)}
                placeholder="Buscar por nombre o código..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #007bff',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0056b3';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#007bff';
                  e.target.style.boxShadow = 'none';
                }}
              />
              
              {/* Dropdown de resultados de búsqueda */}
              {filteredCuadrillas.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '2px solid #007bff',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  maxHeight: 200,
                  overflowY: 'auto',
                  zIndex: 1001,
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }}>
                  {filteredCuadrillas.slice(0, 10).map((cuadrilla) => (
                    <div
                      key={cuadrilla.id}
                      onClick={() => selectCuadrilla(cuadrilla)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        fontSize: 12,
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#333' }}>
                        📍 {cuadrilla.codigo} - {cuadrilla.nombre}
                      </div>
                      <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                        🏷️ Categoría: {cuadrilla.categoria || 'N/A'} | 
                        📌 {cuadrilla.region || 'N/A'}
                      </div>
                    </div>
                  ))}
                  {filteredCuadrillas.length > 10 && (
                    <div style={{
                      padding: '8px 12px',
                      fontSize: 11,
                      color: '#666',
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}>
                      Mostrando primeras 10 de {filteredCuadrillas.length} coincidencias...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Cuadrilla seleccionada */}
          {selectedCuadrilla && (
            <div style={{
              padding: 8,
              background: 'linear-gradient(135deg, #ff6b35, #f7931e)',
              borderRadius: 8,
              color: 'white',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  🎯 {selectedCuadrilla.codigo} - {selectedCuadrilla.nombre}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>
                  Categoría: {selectedCuadrilla.categoria} | {selectedCuadrilla.region}
                </div>
              </div>
              <button
                onClick={() => setSelectedCuadrilla(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ✖️
              </button>
            </div>
          )}
        </div>

        {/* Fila 2: Selectores y botones de filtro */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 15, 
          marginBottom: 15,
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: 6,
          border: '1px solid #dee2e6'
        }}>
          {/* Selector de Región */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>Región:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontSize: 13,
                minWidth: 180,
                background: 'white',
              }}
            >
              <option value="">Todas las regiones</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>Estado:</label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              style={{
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontSize: 13,
                minWidth: 150,
                background: 'white',
              }}
            >
              <option value="">Todos los estados</option>
              {estadosCatalogo.map((estado) => (
                <option key={estado.codigo} value={estado.nombre}>
                  {estado.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Control de Radio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>Radio (km):</label>
            <input
              type="number"
              min="1"
              max="100"
              value={searchRadius}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 100) {
                  setSearchRadius(value);
                }
              }}
              style={{
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontSize: 13,
                width: 70,
                background: 'white',
                textAlign: 'center',
              }}
              title="Radio de búsqueda (1-100 km)"
            />
          </div>

          {/* Botones de Filtrado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={aplicarFiltros}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              🔍 BUSCAR
            </button>
            <button
              onClick={limpiarFiltros}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
            >
              🗑️ LIMPIAR
            </button>
            
            {/* Botón de prueba para cuadrillas */}
            <button
              onClick={async () => {
                if (!rutaActiva) {
                  // Buscar una cuadrilla para iniciar ruta (usar la primera disponible)
                  const cuadrillaParaRuta = cuadrillas.find(c => c.latitud && c.longitud);
                  if (cuadrillaParaRuta) {
                    iniciarRuta(cuadrillaParaRuta);
                  } else {
                    console.warn('⚠️ No hay cuadrillas disponibles para iniciar ruta');
                    alert('No hay cuadrillas cargadas. Cargar cuadrillas primero.');
                  }
                } else {
                  detenerRuta();
                }
              }}
              style={{
                backgroundColor: rutaActiva ? '#dc3545' : '#28a745',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = rutaActiva ? '#c82333' : '#218838'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rutaActiva ? '#dc3545' : '#28a745'}
            >
              {rutaActiva ? '🛑 DETENER RUTA' : '🚀 INICIAR RUTA'}
            </button>
          </div>
        </div>

        {/* Fila 3: Contadores y estado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: '#333' }}>
            📡 Sites: {sitesLoaded ? `${showSites ? visibleSites.length : 0}/${totals.sites}` : loadingSites ? '⏳' : 'No cargado'} | 
            👥 Cuadrillas: {cuadrillasLoaded ? `${showCuadrillas ? visibleCuadrillas.length : 0}/${totals.cuads}` : loadingCuadrillas ? '⏳' : 'No cargado'} | 
            🎫 Tickets: {ticketsLoaded ? `${showTickets ? visibleTickets.length : 0}/${totals.tickets}` : loadingTickets ? '⏳' : 'No cargado'} | 
            🔗 Total Visible: {(showSites ? visibleSites.length : 0) + (showCuadrillas ? visibleCuadrillas.length : 0) + (showTickets ? visibleTickets.length : 0)}/{totals.total}
          </div>
          
          {/* Indicador de actualización automática */}
          <div style={{ fontSize: 12, color: '#6c757d', display: 'flex', alignItems: 'center', gap: 8 }}>
            {autoUpdateEnabled && showCuadrillas ? (
              <span style={{ color: '#28a745', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ 
                  width: 8, 
                  height: 8, 
                  backgroundColor: '#28a745', 
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite' 
                }}></span>
                🔄 Auto-actualización ACTIVA
              </span>
            ) : (
              <span style={{ color: '#6c757d' }}>
                ⏸️ Auto-actualización PAUSADA
              </span>
            )}
          </div>
        </div>

        {/* Indicador de Ruta Activa */}
        {rutaActiva && cuadrillaSeleccionadaParaRuta && (
          <div style={{
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            color: '#155724',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <strong>🚀 RUTA ACTIVA:</strong> Cuadrilla {cuadrillaSeleccionadaParaRuta.codigo} 
              ({cuadrillaSeleccionadaParaRuta.nombre}) - Registrando ubicación cada 5 segundos
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              📍 Última posición: ({cuadrillaSeleccionadaParaRuta.latitud}, {cuadrillaSeleccionadaParaRuta.longitud})
            </div>
          </div>
        )}

        {/* Indicador de Filtros Activos */}
        {(filtrosActivos.region || filtrosActivos.estado) && (
          <div
            style={{
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              color: '#0056b3',
              marginTop: 10
            }}
          >
            <strong>🔍 Filtros Activos: </strong>
            {filtrosActivos.region && <span>Región: {filtrosActivos.region}</span>}
            {filtrosActivos.region && filtrosActivos.estado && <span> | </span>}
            {filtrosActivos.estado && <span>Estado: {filtrosActivos.estado}</span>}
          </div>
        )}
      </div>

      {/* Área del Mapa */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          paddingTop: 200 // Espacio para el panel de control
        }}
      >
        {apiKeyError && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50%',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: 8,
            margin: 20,
            padding: 20,
            flexDirection: 'column'
          }}>
            <h3 style={{ color: '#856404', marginBottom: 16 }}>⚠️ Error de Configuración de Google Maps</h3>
            <p style={{ color: '#856404', textAlign: 'center', marginBottom: 16 }}>
              No se pudo cargar Google Maps. La API Key no está configurada correctamente.
            </p>
            <div style={{ backgroundColor: '#f8f9fa', padding: 12, borderRadius: 4, fontSize: 14, color: '#6c757d', textAlign: 'center' }}>
              <div><strong>🔧 Para Desarrolladores:</strong></div>
              <div>• Local: Agregar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY a .env.local</div>
              <div>• Vercel: Configurar variable en Settings → Environment Variables</div>
              <div>• Valor necesario: AIzaSyBmtiE0jWFGUFAZXoBgF3XyXmBmJit6m6U</div>
            </div>
          </div>
        )}
      </div>

      {/* Panel de Resultados de Rutas */}
      {selectedTicket && routeResults.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 400,
          maxHeight: '40vh',
          overflowY: 'auto',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '2px solid #007bff',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid #dee2e6'
          }}>
            <h3 style={{ 
              margin: 0, 
              color: '#007bff', 
              fontSize: 16,
              fontWeight: 600
            }}>
              🛣️ Rutas Calculadas
            </h3>
            <button
              onClick={() => {
                setSelectedTicket(null);
                setRouteResults([]);
              }}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              ✖️ Cerrar
            </button>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
              📍 Desde: {selectedTicket.codigo} - {selectedTicket.nombre}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              📊 Estado: {selectedTicket.estadoTicket || 'N/A'}<br/>
              📌 Región: {selectedTicket.region || 'N/A'}<br/>
              🏷️ Categoría: <span style={{ fontWeight: 600, color: '#007bff' }}>{selectedTicket.categoria || 'Sin categoría'}</span>
            </div>
          </div>

          {calculatingRoutes && (
            <div style={{ 
              textAlign: 'center', 
              padding: 12,
              backgroundColor: '#e3f2fd',
              borderRadius: 4,
              marginBottom: 12 
            }}>
              <div style={{ fontSize: 14, color: '#1976d2' }}>
                � Calculando rutas con Google Routes API...
              </div>
            </div>
          )}

          <div>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              color: '#28a745', 
              fontSize: 14,
              fontWeight: 600
            }}>
              🎯 Cuadrillas Categoría {selectedTicket.categoria || 'N/A'} ({routeResults.length})
            </h4>
            
            {routeResults.map((result, index) => (
              <div 
                key={result.cuadrilla.id}
                style={{
                  padding: 10,
                  marginBottom: 8,
                  backgroundColor: index === 0 ? '#d4edda' : '#f8f9fa',
                  borderRadius: 4,
                  borderLeft: index === 0 ? '4px solid #28a745' : '4px solid #6c757d',
                  fontSize: 12
                }}
              >
                <div style={{ 
                  fontWeight: 600, 
                  color: '#333',
                  marginBottom: 4
                }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍'} {result.cuadrilla.codigo} - {result.cuadrilla.nombre}
                </div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  ⏱️ Tiempo: {result.duration.toFixed(1)} min<br/>
                  📏 Distancia: {result.distance.toFixed(2)} km<br/>
                  🏷️ Categoría: {result.cuadrilla.categoria || 'N/A'}
                </div>
                <button
                  style={{
                    marginTop: 8,
                    padding: '6px 16px',
                    background: '#198754',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                  onClick={async () => {
                    if (!selectedTicket) {
                      alert('No hay ticket seleccionado para asignar.');
                      return;
                    }
                    const ticketId = selectedTicket.id;
                    const cuadrillaId = result.cuadrilla.id;
                    const fechaAsignacion = new Date().toISOString();
                    const usuarioCreacion = 'sistema';
                    const { error: insertError } = await supabase
                      .from('cuadrilla_ticket_estados')
                      .insert({
                        ticket_id: ticketId,
                        cuadrilla_id: cuadrillaId,
                        fecha_asignacion: fechaAsignacion,
                        usuario_creacion: usuarioCreacion,
                        estado: 'ASIGNADO'
                      });
                    if (insertError) {
                      alert('Error al asignar cuadrilla: ' + insertError.message);
                      return;
                    }
                    const { error: updateError } = await supabase
                      .from('tickets_v1')
                      .update({ estado: 'ASIGNADO' })
                      .eq('id', ticketId);
                    if (updateError) {
                      alert('Error al actualizar estado del ticket: ' + updateError.message);
                      return;
                    }
                    alert(`Cuadrilla asignada correctamente: ${result.cuadrilla.codigo}`);
                  }}
                >
                  ASIGNAR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indicator de carga de mapa */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: 20,
          borderRadius: 8,
          textAlign: 'center',
          zIndex: 2000
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🗺️</div>
          <div style={{ fontSize: 16, color: '#333' }}>Cargando Google Maps...</div>
        </div>
      )}
    </div>
    </>
  );
}

function updateMapMarkers() {
  // Esta función se puede usar para actualizar marcadores cuando se implementen
  console.log('Actualizando marcadores del mapa...');
}