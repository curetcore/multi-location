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
  const [sortBy, setSortBy] = useState('name'); // 'name', 'inventory', 'sales', 'efficiency'
  
  // Filtrar y ordenar ubicaciones
  const filteredLocations = locations
    .filter(location => {
      const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           location.address?.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'active' && location.isActive) ||
                           (filterStatus === 'inactive' && !location.isActive);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'inventory':
          return b.metrics.totalItems - a.metrics.totalItems;
        case 'sales':
          return b.metrics.monthlySales - a.metrics.monthlySales;
        case 'efficiency':
          return b.metrics.efficiency - a.metrics.efficiency;
        default:
          return 0;
      }
    });
  
  const handleLocationClick = (locationId) => {
    navigate(`/app/sucursal/${locationId.split('/').pop()}`);
  };
  
  return (
    <s-page>
      {/* Header mejorado */}
      <s-section>
        <s-layout>
          <s-layout-section variant="full">
            <s-stack gap="tight">
              <s-stack direction="inline" alignment="space-between">
                <div>
                  <s-heading size="extra-large">Gestión de Sucursales</s-heading>
                  <s-text subdued size="medium">
                    Administra y monitorea el rendimiento de tus {locations.length} sucursales
                  </s-text>
                </div>
                <s-button onClick={() => navigate('/app/sucursal/nueva')}>
                  Agregar Sucursal
                </s-button>
              </s-stack>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Controles mejorados */}
      <s-section>
        <s-card style={{ background: '#f6f6f7' }}>
          <s-layout>
            <s-layout-section variant="one-third">
              <s-text-field
                label="Buscar sucursal"
                labelHidden
                placeholder="Buscar por nombre o ciudad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                clearButton
                onClearButtonClick={() => setSearchTerm('')}
                prefix="🔍"
              />
            </s-layout-section>
            
            <s-layout-section variant="two-thirds">
              <s-stack direction="inline" alignment="end" gap="tight">
                <s-select
                  label="Estado"
                  labelHidden
                  options={[
                    { label: 'Todas las sucursales', value: 'all' },
                    { label: 'Solo activas', value: 'active' },
                    { label: 'Solo inactivas', value: 'inactive' }
                  ]}
                  value={filterStatus}
                  onChange={(value) => setFilterStatus(value)}
                />
                
                <s-select
                  label="Ordenar por"
                  labelHidden
                  options={[
                    { label: 'Nombre A-Z', value: 'name' },
                    { label: 'Mayor inventario', value: 'inventory' },
                    { label: 'Mayores ventas', value: 'sales' },
                    { label: 'Mayor eficiencia', value: 'efficiency' }
                  ]}
                  value={sortBy}
                  onChange={(value) => setSortBy(value)}
                />
                
                <s-button-group>
                  <s-button
                    variant={viewMode === 'grid' ? 'primary' : 'tertiary'}
                    onClick={() => setViewMode('grid')}
                    size="small"
                  >
                    Vista Grid
                  </s-button>
                  <s-button
                    variant={viewMode === 'list' ? 'primary' : 'tertiary'}
                    onClick={() => setViewMode('list')}
                    size="small"
                  >
                    Vista Lista
                  </s-button>
                </s-button-group>
              </s-stack>
            </s-layout-section>
          </s-layout>
        </s-card>
      </s-section>
      
      {/* KPIs mejorados */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderTop: '3px solid #008060',
              textAlign: 'center'
            }}>
              <s-stack gap="tight" alignment="center">
                <div style={{ 
                  fontSize: '32px',
                  background: '#f0fdf4',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  🏪
                </div>
                <s-text size="extra-large" emphasis="bold">{locations.length}</s-text>
                <s-text subdued>Sucursales Totales</s-text>
                <s-badge tone="info">
                  {locations.filter(l => l.isActive).length} activas
                </s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderTop: '3px solid #5630ff',
              textAlign: 'center'
            }}>
              <s-stack gap="tight" alignment="center">
                <div style={{ 
                  fontSize: '32px',
                  background: '#f3f0ff',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  📦
                </div>
                <s-text size="extra-large" emphasis="bold">
                  {locations.reduce((sum, l) => sum + l.metrics.totalItems, 0).toLocaleString()}
                </s-text>
                <s-text subdued>Inventario Total</s-text>
                <s-badge tone="success">+8.5% mes</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderTop: '3px solid #e3b505',
              textAlign: 'center'
            }}>
              <s-stack gap="tight" alignment="center">
                <div style={{ 
                  fontSize: '32px',
                  background: '#fffbeb',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  💰
                </div>
                <s-text size="extra-large" emphasis="bold">
                  ${(locations.reduce((sum, l) => sum + l.metrics.monthlySales, 0) / 1000).toFixed(0)}k
                </s-text>
                <s-text subdued>Ventas Mensuales</s-text>
                <s-badge tone="success">+12% mes</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderTop: '3px solid #00a0ac',
              textAlign: 'center'
            }}>
              <s-stack gap="tight" alignment="center">
                <div style={{ 
                  fontSize: '32px',
                  background: '#f0fdfa',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  📊
                </div>
                <s-text size="extra-large" emphasis="bold">
                  {Math.round(locations.reduce((sum, l) => sum + l.metrics.efficiency, 0) / locations.length)}%
                </s-text>
                <s-text subdued>Eficiencia Promedio</s-text>
                <s-badge tone="warning">Estable</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Vista Grid o Lista */}
      <s-section>
        {viewMode === 'grid' ? (
          <s-layout>
            {filteredLocations.map((location) => {
              const efficiencyColor = location.metrics.efficiency > 75 ? '#36c98d' : 
                                    location.metrics.efficiency > 50 ? '#ffb800' : '#d83c3e';
              
              return (
                <s-layout-section key={location.id} variant="one-third">
                  <s-card
                    onClick={() => handleLocationClick(location.id)}
                    style={{ 
                      cursor: 'pointer', 
                      marginBottom: '1rem',
                      transition: 'all 0.3s ease',
                      border: '1px solid #e1e3e5',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Indicador de estado superior */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: location.isActive ? '#36c98d' : '#d83c3e'
                    }} />
                    
                    <s-stack gap="base">
                      {/* Header mejorado */}
                      <s-stack gap="tight">
                        <s-stack direction="inline" alignment="space-between">
                          <s-heading size="medium">{location.name}</s-heading>
                          <s-badge tone={location.isActive ? 'success' : 'critical'} size="small">
                            {location.isActive ? '✓ Activa' : '✗ Inactiva'}
                          </s-badge>
                        </s-stack>
                        <s-stack direction="inline" gap="extra-tight" alignment="center">
                          <span style={{ fontSize: '14px' }}>📍</span>
                          <s-text subdued size="small">
                            {location.address?.city || 'Ciudad'}, {location.address?.province || location.address?.country || 'País'}
                          </s-text>
                        </s-stack>
                      </s-stack>
                      
                      {/* Métricas en grid 2x2 */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '12px',
                        padding: '12px',
                        background: '#f6f6f7',
                        borderRadius: '8px'
                      }}>
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Inventario</s-text>
                          <s-text emphasis="bold" size="medium">{location.metrics.totalItems.toLocaleString()}</s-text>
                          <s-text size="small" tone="success">+5% mes</s-text>
                        </s-stack>
                        
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Ventas mes</s-text>
                          <s-text emphasis="bold" size="medium">
                            ${(location.metrics.monthlySales / 1000).toFixed(0)}k
                          </s-text>
                          <s-text size="small" tone="success">+12% mes</s-text>
                        </s-stack>
                        
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Productos</s-text>
                          <s-text emphasis="bold" size="medium">{location.metrics.productCount}</s-text>
                          <s-text size="small" subdued>SKUs</s-text>
                        </s-stack>
                        
                        <s-stack gap="extra-tight">
                          <s-text size="small" subdued>Personal</s-text>
                          <s-text emphasis="bold" size="medium">{location.metrics.staffCount}</s-text>
                          <s-text size="small" subdued>empleados</s-text>
                        </s-stack>
                      </div>
                      
                      {/* Indicador de eficiencia visual */}
                      <s-stack gap="tight">
                        <s-stack direction="inline" alignment="space-between">
                          <s-text size="small" subdued>Eficiencia operativa</s-text>
                          <s-text size="small" emphasis="bold" style={{ color: efficiencyColor }}>
                            {location.metrics.efficiency}%
                          </s-text>
                        </s-stack>
                        <div style={{ 
                          height: '8px',
                          background: '#e1e3e5',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${location.metrics.efficiency}%`,
                            background: efficiencyColor,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </s-stack>
                      
                      {/* Botón de acción */}
                      <s-button fullWidth variant="secondary">
                        Ver detalles →
                      </s-button>
                    </s-stack>
                  </s-card>
                </s-layout-section>
              );
            })}
            
            {filteredLocations.length === 0 && (
              <s-layout-section variant="full">
                <s-card style={{ textAlign: 'center', padding: '40px' }}>
                  <s-stack gap="base" alignment="center">
                    <div style={{ fontSize: '48px' }}>🔍</div>
                    <s-heading>No se encontraron sucursales</s-heading>
                    <s-text subdued>Intenta ajustar los filtros de búsqueda</s-text>
                    <s-button 
                      variant="secondary" 
                      onClick={() => {
                        setSearchTerm('');
                        setFilterStatus('all');
                      }}
                    >
                      Limpiar filtros
                    </s-button>
                  </s-stack>
                </s-card>
              </s-layout-section>
            )}
          </s-layout>
        ) : (
          /* Vista Lista mejorada */
          <s-card>
            <div style={{ overflowX: 'auto' }}>
              <s-table>
                <s-table-head>
                  <s-table-row>
                    <s-table-header>Sucursal</s-table-header>
                    <s-table-header>Estado</s-table-header>
                    <s-table-header>Inventario</s-table-header>
                    <s-table-header>Valor Stock</s-table-header>
                    <s-table-header>Ventas Mes</s-table-header>
                    <s-table-header>Eficiencia</s-table-header>
                    <s-table-header>Tendencia</s-table-header>
                    <s-table-header>Acciones</s-table-header>
                  </s-table-row>
                </s-table-head>
                <s-table-body>
                  {filteredLocations.map((location) => {
                    const trend = Math.random() > 0.5; // Simulado
                    const efficiencyColor = location.metrics.efficiency > 75 ? '#36c98d' : 
                                          location.metrics.efficiency > 50 ? '#ffb800' : '#d83c3e';
                    
                    return (
                      <s-table-row 
                        key={location.id}
                        hover
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleLocationClick(location.id)}
                      >
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-stack direction="inline" gap="extra-tight" alignment="center">
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: location.isActive ? '#36c98d' : '#d83c3e'
                              }} />
                              <s-text emphasis="strong">{location.name}</s-text>
                            </s-stack>
                            <s-text size="small" subdued>
                              📍 {location.address?.city || 'Ciudad'}, {location.address?.province || 'Provincia'}
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone={location.isActive ? 'success' : 'critical'} size="small">
                            {location.isActive ? '✓ Activa' : '✗ Inactiva'}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-text emphasis="strong">{location.metrics.totalItems.toLocaleString()}</s-text>
                            <s-text size="small" subdued>{location.metrics.productCount} SKUs</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-text emphasis="strong">
                            ${location.metrics.totalValue.toLocaleString('es-DO', { 
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0 
                            })}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-text emphasis="strong">
                              ${(location.metrics.monthlySales / 1000).toFixed(0)}k
                            </s-text>
                            <s-text size="small" tone="success">+12%</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <div style={{ 
                              height: '6px',
                              width: '80px',
                              background: '#e1e3e5',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${location.metrics.efficiency}%`,
                                background: efficiencyColor,
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                            <s-text size="small">{location.metrics.efficiency}%</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack direction="inline" gap="extra-tight" alignment="center">
                            <span style={{ 
                              color: trend ? '#36c98d' : '#d83c3e',
                              fontSize: '20px'
                            }}>
                              {trend ? '↑' : '↓'}
                            </span>
                            <s-text size="small" tone={trend ? 'success' : 'critical'}>
                              {trend ? '+' : '-'}{Math.round(Math.random() * 15 + 5)}%
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-button variant="tertiary" size="small">
                            Analizar
                          </s-button>
                        </s-table-cell>
                      </s-table-row>
                    );
                  })}
                  
                  {filteredLocations.length === 0 && (
                    <s-table-row>
                      <s-table-cell colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                        <s-stack gap="base" alignment="center">
                          <div style={{ fontSize: '48px' }}>🔍</div>
                          <s-text subdued>No se encontraron sucursales con los filtros seleccionados</s-text>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  )}
                </s-table-body>
              </s-table>
            </div>
          </s-card>
        )}
      </s-section>
      
      {/* Footer con información adicional */}
      {filteredLocations.length > 0 && (
        <s-section>
          <s-card style={{ background: '#f6f6f7', textAlign: 'center' }}>
            <s-text subdued>
              Mostrando {filteredLocations.length} de {locations.length} sucursales
            </s-text>
          </s-card>
        </s-section>
      )}
    </s-page>
  );
}