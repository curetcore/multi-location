import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Obtener todas las ubicaciones con métricas
    const locationsResponse = await admin.graphql(
      `#graphql
        query getLocationsWithMetrics {
          locations(first: 20) {
            edges {
              node {
                id
                name
                address {
                  address1
                  city
                  province
                  country
                }
                isActive
              }
            }
          }
        }
      `
    );
    
    const locationsData = await locationsResponse.json();
    const locations = locationsData.data?.locations?.edges || [];
    
    // Obtener métricas básicas para cada ubicación
    const locationsWithMetrics = await Promise.all(
      locations.map(async ({ node: location }) => {
        const inventoryResponse = await admin.graphql(
          `#graphql
            query getLocationMetrics($locationId: ID!) {
              location(id: $locationId) {
                inventoryLevels(first: 250) {
                  edges {
                    node {
                      quantities(names: ["available"]) {
                        quantity
                      }
                      item {
                        variant {
                          price
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          { variables: { locationId: location.id } }
        );
        
        const inventoryData = await inventoryResponse.json();
        const inventory = inventoryData.data?.location?.inventoryLevels?.edges || [];
        
        const totalItems = inventory.reduce((sum, { node }) => 
          sum + (node.quantities[0]?.quantity || 0), 0
        );
        
        const totalValue = inventory.reduce((sum, { node }) => {
          const quantity = node.quantities[0]?.quantity || 0;
          const price = parseFloat(node.item?.variant?.price || 0);
          return sum + (quantity * price);
        }, 0);
        
        return {
          ...location,
          metrics: {
            totalItems,
            totalValue,
            productCount: inventory.length,
            // Datos simulados para demo
            monthlySales: Math.round(Math.random() * 50000 + 10000),
            efficiency: Math.round(Math.random() * 40 + 60),
            staffCount: Math.round(Math.random() * 8 + 2)
          }
        };
      })
    );
    
    return { locations: locationsWithMetrics };
  } catch (error) {
    console.error("Error loading locations:", error);
    return { locations: [] };
  }
};

export default function Sucursales() {
  const { locations } = useLoaderData();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  
  // Filtrar ubicaciones
  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.address?.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && location.isActive) ||
                         (filterStatus === 'inactive' && !location.isActive);
    return matchesSearch && matchesStatus;
  });
  
  const handleLocationClick = (locationId) => {
    navigate(`/app/sucursal/${locationId.split('/').pop()}`);
  };
  
  return (
    <s-page heading="Centro de Sucursales">
      {/* Controles superiores */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-half">
            <s-text-field
              label="Buscar sucursal"
              placeholder="Nombre o ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              clearButton
              onClearButtonClick={() => setSearchTerm('')}
            />
          </s-layout-section>
          
          <s-layout-section variant="one-half">
            <s-stack direction="inline" alignment="end" gap="tight">
              <s-select
                label="Estado"
                options={[
                  { label: 'Todas', value: 'all' },
                  { label: 'Activas', value: 'active' },
                  { label: 'Inactivas', value: 'inactive' }
                ]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
              />
              
              <s-button-group>
                <s-button
                  variant={viewMode === 'grid' ? 'primary' : 'tertiary'}
                  onClick={() => setViewMode('grid')}
                  icon="GridIcon"
                >
                  Grid
                </s-button>
                <s-button
                  variant={viewMode === 'list' ? 'primary' : 'tertiary'}
                  onClick={() => setViewMode('list')}
                  icon="ListIcon"
                >
                  Lista
                </s-button>
              </s-button-group>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Resumen rápido */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Total Sucursales</s-text>
                <s-text size="large" emphasis="bold">{locations.length}</s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Sucursales Activas</s-text>
                <s-text size="large" emphasis="bold">
                  {locations.filter(l => l.isActive).length}
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Inventario Total</s-text>
                <s-text size="large" emphasis="bold">
                  {locations.reduce((sum, l) => sum + l.metrics.totalItems, 0).toLocaleString()}
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Valor Total</s-text>
                <s-text size="large" emphasis="bold">
                  ${locations.reduce((sum, l) => sum + l.metrics.totalValue, 0).toLocaleString('es-DO', { 
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0 
                  })}
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Vista Grid o Lista */}
      <s-section>
        {viewMode === 'grid' ? (
          <s-layout>
            {filteredLocations.map((location) => (
              <s-layout-section key={location.id} variant="one-third">
                <s-card
                  hover
                  onClick={() => handleLocationClick(location.id)}
                  style={{ cursor: 'pointer', marginBottom: '1rem' }}
                >
                  <s-stack gap="base">
                    {/* Header */}
                    <s-stack direction="inline" alignment="space-between">
                      <s-heading>{location.name}</s-heading>
                      <s-badge tone={location.isActive ? 'success' : 'critical'}>
                        {location.isActive ? 'Activa' : 'Inactiva'}
                      </s-badge>
                    </s-stack>
                    
                    {/* Dirección */}
                    <s-text subdued>
                      {location.address?.city || 'Sin ciudad'}, {location.address?.province || location.address?.country}
                    </s-text>
                    
                    {/* Métricas principales */}
                    <s-divider />
                    
                    <s-layout>
                      <s-layout-section variant="one-half">
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Inventario</s-text>
                          <s-text emphasis="bold">{location.metrics.totalItems.toLocaleString()}</s-text>
                          <s-text size="small" subdued>items</s-text>
                        </s-stack>
                      </s-layout-section>
                      
                      <s-layout-section variant="one-half">
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Ventas/mes</s-text>
                          <s-text emphasis="bold">
                            ${location.metrics.monthlySales.toLocaleString()}
                          </s-text>
                          <s-text size="small" subdued>últimos 30 días</s-text>
                        </s-stack>
                      </s-layout-section>
                    </s-layout>
                    
                    <s-divider />
                    
                    {/* Indicadores adicionales */}
                    <s-layout>
                      <s-layout-section variant="one-third">
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Productos</s-text>
                          <s-text>{location.metrics.productCount}</s-text>
                        </s-stack>
                      </s-layout-section>
                      
                      <s-layout-section variant="one-third">
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Eficiencia</s-text>
                          <s-text>{location.metrics.efficiency}%</s-text>
                        </s-stack>
                      </s-layout-section>
                      
                      <s-layout-section variant="one-third">
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Staff</s-text>
                          <s-text>{location.metrics.staffCount}</s-text>
                        </s-stack>
                      </s-layout-section>
                    </s-layout>
                    
                    {/* Gráfica mini de tendencia */}
                    <s-stack gap="tight">
                      <s-text size="small" subdued>Tendencia 7 días</s-text>
                      <div style={{ 
                        height: '40px', 
                        background: 'linear-gradient(to right, #008060 0%, #5630ff 100%)',
                        opacity: 0.1,
                        borderRadius: '4px'
                      }} />
                    </s-stack>
                    
                    {/* Acción */}
                    <s-button fullWidth variant="secondary">
                      Ver detalles
                    </s-button>
                  </s-stack>
                </s-card>
              </s-layout-section>
            ))}
          </s-layout>
        ) : (
          /* Vista Lista */
          <s-card>
            <s-table>
              <s-table-head>
                <s-table-row>
                  <s-table-header>Sucursal</s-table-header>
                  <s-table-header>Estado</s-table-header>
                  <s-table-header>Inventario</s-table-header>
                  <s-table-header>Valor</s-table-header>
                  <s-table-header>Ventas/mes</s-table-header>
                  <s-table-header>Eficiencia</s-table-header>
                  <s-table-header>Staff</s-table-header>
                  <s-table-header>Acciones</s-table-header>
                </s-table-row>
              </s-table-head>
              <s-table-body>
                {filteredLocations.map((location) => (
                  <s-table-row 
                    key={location.id}
                    hover
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleLocationClick(location.id)}
                  >
                    <s-table-cell>
                      <s-stack gap="extra-tight">
                        <s-text emphasis="strong">{location.name}</s-text>
                        <s-text size="small" subdued>
                          {location.address?.city || 'Sin ciudad'}
                        </s-text>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={location.isActive ? 'success' : 'critical'}>
                        {location.isActive ? 'Activa' : 'Inactiva'}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>{location.metrics.totalItems.toLocaleString()}</s-table-cell>
                    <s-table-cell>
                      ${location.metrics.totalValue.toLocaleString('es-DO', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0 
                      })}
                    </s-table-cell>
                    <s-table-cell>
                      ${location.metrics.monthlySales.toLocaleString()}
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={location.metrics.efficiency > 80 ? 'success' : 'warning'}>
                        {location.metrics.efficiency}%
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>{location.metrics.staffCount}</s-table-cell>
                    <s-table-cell>
                      <s-button variant="tertiary" size="small">
                        Ver detalles
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-card>
        )}
      </s-section>
      
      {/* Acciones flotantes */}
      <s-section slot="aside" heading="Acciones Rápidas">
        <s-stack gap="base">
          <s-button fullWidth onClick={() => navigate('/app/sucursal/nueva')}>
            Agregar Sucursal
          </s-button>
          <s-button fullWidth variant="secondary">
            Comparar Sucursales
          </s-button>
          <s-button fullWidth variant="tertiary">
            Exportar Reporte
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}