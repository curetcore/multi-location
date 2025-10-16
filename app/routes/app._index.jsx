import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // 1. Obtener información básica de la tienda
    const shopResponse = await admin.graphql(
      `#graphql
        query getShopInfo {
          shop {
            name
            currencyCode
          }
        }
      `
    );
    
    const shopData = await shopResponse.json();
    const shop = shopData.data?.shop;
    
    // 2. Obtener todas las ubicaciones
    const locationsResponse = await admin.graphql(
      `#graphql
        query getLocations {
          locations(first: 10) {
            edges {
              node {
                id
                name
                isActive
              }
            }
          }
        }
      `
    );
    
    const locationsData = await locationsResponse.json();
    const locations = locationsData.data?.locations?.edges || [];
    
    // 3. Por ahora retornamos solo datos básicos
    return {
      shop,
      locations,
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return {
      shop: null,
      locations: [],
      lastUpdate: new Date().toISOString()
    };
  }
};

export default function DashboardNuevo() {
  const { shop, locations, lastUpdate } = useLoaderData();
  const navigate = useNavigate();
  
  // Estado para el período seleccionado
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  
  // Calcular sucursales activas
  const activeLocations = locations.filter(loc => loc.node.isActive).length;
  const totalLocations = locations.length;
  
  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* HEADER MODERNO */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px 0',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 30px' }}>
          {/* Título principal */}
          <div style={{ marginBottom: '30px' }}>
            <h1 style={{ 
              color: 'white', 
              fontSize: '42px', 
              fontWeight: '700',
              margin: '0 0 10px 0',
              letterSpacing: '-1px'
            }}>
              Dashboard Analítico
            </h1>
            <p style={{ 
              color: 'rgba(255,255,255,0.9)', 
              fontSize: '18px',
              margin: 0
            }}>
              {shop?.name || 'Multi-Location Analytics'} • {activeLocations} sucursales activas
            </p>
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            {/* Estadísticas rápidas */}
            <div style={{ display: 'flex', gap: '30px' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 5px 0' }}>Última actualización</p>
                <p style={{ color: 'white', fontSize: '20px', fontWeight: '600', margin: 0 }}>
                  {new Date(lastUpdate).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 5px 0' }}>Moneda</p>
                <p style={{ color: 'white', fontSize: '20px', fontWeight: '600', margin: 0 }}>
                  {shop?.currencyCode || 'DOP'}
                </p>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 5px 0' }}>Estado</p>
                <p style={{ color: '#4ade80', fontSize: '20px', fontWeight: '600', margin: 0 }}>
                  ● Activo
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <select 
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)'
                }}
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="7d" style={{ color: 'black' }}>Últimos 7 días</option>
                <option value="30d" style={{ color: 'black' }}>Últimos 30 días</option>
                <option value="90d" style={{ color: 'black' }}>Últimos 90 días</option>
                <option value="year" style={{ color: 'black' }}>Este año</option>
              </select>

              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '18px' }}>↻</span>
                Actualizar
              </button>

              <button
                onClick={() => navigate('/app/analytics')}
                style={{
                  background: 'white',
                  color: '#667eea',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                }}
              >
                Ver Analytics Completo →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px' }}>
        {/* Placeholder temporal */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ color: '#667eea', marginBottom: '10px' }}>🎨 Nuevo diseño en progreso</h3>
          <p style={{ color: '#6b7280' }}>Header completado. Las siguientes secciones se agregarán paso a paso.</p>
        </div>
      </div>
    </div>
  );
}