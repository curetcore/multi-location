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
    <s-page>
      {/* HEADER SECTION - Solo el header limpio y funcional */}
      <s-section>
        <s-card style={{ background: '#ffffff', border: '1px solid #e1e3e5' }}>
          <s-layout>
            <s-layout-section variant="full">
              <s-stack gap="tight">
                {/* Título y descripción */}
                <s-stack direction="inline" alignment="space-between">
                  <s-stack gap="extra-tight">
                    <s-heading size="extra-large">
                      Dashboard de {shop?.name || 'Multi-Location Analytics'}
                    </s-heading>
                    <s-text subdued size="medium">
                      Monitoreo en tiempo real de {activeLocations} {activeLocations === 1 ? 'sucursal activa' : 'sucursales activas'} de {totalLocations} totales
                    </s-text>
                  </s-stack>
                  
                  {/* Controles del header */}
                  <s-stack direction="inline" gap="tight" alignment="center">
                    {/* Selector de período */}
                    <s-select
                      label="Período"
                      labelHidden
                      options={[
                        { label: 'Últimos 7 días', value: '7d' },
                        { label: 'Últimos 30 días', value: '30d' },
                        { label: 'Últimos 90 días', value: '90d' },
                        { label: 'Este año', value: 'year' }
                      ]}
                      value={selectedPeriod}
                      onChange={setSelectedPeriod}
                    />
                    
                    {/* Botón de actualizar */}
                    <s-button 
                      variant="secondary"
                      onClick={() => window.location.reload()}
                      icon="RefreshIcon"
                    >
                      Actualizar
                    </s-button>
                    
                    {/* Botón principal */}
                    <s-button 
                      variant="primary"
                      onClick={() => navigate('/app/analytics')}
                    >
                      Ver Analytics Completo
                    </s-button>
                  </s-stack>
                </s-stack>
                
                {/* Información adicional del header */}
                <s-divider />
                
                <s-stack direction="inline" alignment="space-between">
                  <s-stack direction="inline" gap="loose">
                    <s-stack gap="extra-tight">
                      <s-text size="small" subdued>Última actualización</s-text>
                      <s-text size="small" emphasis="strong">
                        {new Date(lastUpdate).toLocaleTimeString('es-DO', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </s-text>
                    </s-stack>
                    
                    <s-stack gap="extra-tight">
                      <s-text size="small" subdued>Moneda</s-text>
                      <s-text size="small" emphasis="strong">{shop?.currencyCode || 'DOP'}</s-text>
                    </s-stack>
                    
                    <s-stack gap="extra-tight">
                      <s-text size="small" subdued>Período seleccionado</s-text>
                      <s-text size="small" emphasis="strong">
                        {selectedPeriod === '7d' ? '7 días' : 
                         selectedPeriod === '30d' ? '30 días' : 
                         selectedPeriod === '90d' ? '90 días' : 'Este año'}
                      </s-text>
                    </s-stack>
                  </s-stack>
                  
                  <s-text size="small" subdued>
                    Los datos se actualizan automáticamente cada 15 minutos
                  </s-text>
                </s-stack>
              </s-stack>
            </s-layout-section>
          </s-layout>
        </s-card>
      </s-section>
      
      {/* PLACEHOLDER para las siguientes secciones */}
      <s-section>
        <s-banner tone="info">
          <s-text>Header completado. Las siguientes secciones se agregarán paso a paso.</s-text>
        </s-banner>
      </s-section>
    </s-page>
  );
}