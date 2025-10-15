import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ComposedChart, Area
} from 'recharts';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Obtener ubicaciones
    const locationsResponse = await admin.graphql(
      `#graphql
        query getLocations {
          locations(first: 10) {
            edges {
              node {
                id
                name
                address {
                  city
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
    
    // Obtener inventario Y ordenes para cada ubicación
    const locationAnalytics = await Promise.all(
      locations.map(async ({ node: location }) => {
        // Inventario actual
        const inventoryResponse = await admin.graphql(
          `#graphql
            query getLocationInventory($locationId: ID!) {
              location(id: $locationId) {
                id
                inventoryLevels(first: 250) {
                  edges {
                    node {
                      quantities(names: ["available", "reserved", "on_hand"]) {
                        name
                        quantity
                      }
                      item {
                        variant {
                          price
                          product {
                            title
                            id
                          }
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
        
        // Órdenes de los últimos 30 días
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const ordersResponse = await admin.graphql(
          `#graphql
            query getLocationOrders($query: String!) {
              orders(first: 250, query: $query) {
                edges {
                  node {
                    id
                    totalPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    lineItems(first: 50) {
                      edges {
                        node {
                          quantity
                          variant {
                            id
                            price
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          { 
            variables: { 
              query: `created_at:>='${thirtyDaysAgo.toISOString()}' AND location_id:${location.id.split('/').pop()}` 
            } 
          }
        );
        
        const inventoryData = await inventoryResponse.json();
        const ordersData = await ordersResponse.json();
        
        const inventoryLevels = inventoryData.data?.location?.inventoryLevels?.edges || [];
        const orders = ordersData.data?.orders?.edges || [];
        
        // Calcular métricas de inventario
        let totalAvailable = 0;
        let totalReserved = 0;
        let totalOnHand = 0;
        let inventoryValue = 0;
        let uniqueProducts = inventoryLevels.length;
        
        inventoryLevels.forEach(({ node }) => {
          const quantities = {};
          node.quantities.forEach(q => {
            quantities[q.name] = q.quantity;
          });
          
          const price = parseFloat(node.item?.variant?.price || 0);
          totalAvailable += quantities.available || 0;
          totalReserved += quantities.reserved || 0;
          totalOnHand += quantities.on_hand || 0;
          inventoryValue += (quantities.available || 0) * price;
        });
        
        // Calcular métricas de ventas
        let unitsSold = 0;
        let salesValue = 0;
        
        orders.forEach(({ node: order }) => {
          order.lineItems.edges.forEach(({ node: item }) => {
            unitsSold += item.quantity;
          });
          salesValue += parseFloat(order.totalPriceSet.shopMoney.amount);
        });
        
        // Calcular KPIs
        const turnoverRate = totalAvailable > 0 ? (unitsSold / totalAvailable) : 0;
        const stockCoverage = unitsSold > 0 ? Math.round((totalAvailable / (unitsSold / 30)) * 30) : 999;
        const sellThrough = (totalOnHand + unitsSold) > 0 ? (unitsSold / (totalOnHand + unitsSold)) * 100 : 0;
        
        return {
          location,
          inventory: {
            available: totalAvailable,
            reserved: totalReserved,
            onHand: totalOnHand,
            value: inventoryValue,
            uniqueProducts
          },
          sales: {
            unitsSold,
            value: salesValue,
            avgOrderValue: orders.length > 0 ? salesValue / orders.length : 0,
            ordersCount: orders.length
          },
          kpis: {
            turnoverRate,
            stockCoverage,
            sellThrough
          }
        };
      })
    );
    
    // Calcular totales generales
    const totals = locationAnalytics.reduce((acc, data) => ({
      inventory: acc.inventory + data.inventory.available,
      sold: acc.sold + data.sales.unitsSold,
      value: acc.value + data.inventory.value,
      sales: acc.sales + data.sales.value,
      locations: acc.locations + 1
    }), { inventory: 0, sold: 0, value: 0, sales: 0, locations: 0 });
    
    return { 
      locationAnalytics, 
      totals,
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Error loading analytics:", error);
    return { 
      locationAnalytics: [], 
      totals: { inventory: 0, sold: 0, value: 0, sales: 0, locations: 0 },
      lastUpdate: new Date().toISOString()
    };
  }
};

const COLORS = ['#008060', '#5630ff', '#e3b505', '#ee5737', '#00a0ac'];

export default function Index() {
  const { locationAnalytics, totals, lastUpdate } = useLoaderData();
  const navigate = useNavigate();
  const [animatedTotals, setAnimatedTotals] = useState({
    inventory: 0,
    sold: 0,
    value: 0,
    sales: 0,
    efficiency: 0
  });
  
  // Animación de números
  useEffect(() => {
    const duration = 1000; // 1 segundo
    const steps = 20;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      setAnimatedTotals({
        inventory: Math.round(totals.inventory * progress),
        sold: Math.round(totals.sold * progress),
        value: Math.round(totals.value * progress),
        sales: Math.round(totals.sales * progress),
        efficiency: Math.round((totals.sold / (totals.sold + totals.inventory)) * 100 * progress)
      });
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [totals]);
  
  // Preparar datos para gráficas
  const comparisonData = locationAnalytics.map(data => ({
    name: data.location.name,
    vendidas: data.sales.unitsSold,
    inventario: data.inventory.available,
    rotacion: Math.round(data.kpis.turnoverRate * 100)
  }));
  
  const efficiencyData = locationAnalytics.map(data => ({
    name: data.location.name,
    sellThrough: Math.round(data.kpis.sellThrough),
    stockCoverage: Math.min(data.kpis.stockCoverage, 90),
    turnover: Math.round(data.kpis.turnoverRate * 100)
  }));
  
  // Función para exportar reporte completo
  const exportDetailedReport = () => {
    const headers = [
      'Sucursal', 'Ciudad', 'Estado',
      'Inventario Disponible', 'Unidades Vendidas (30d)', 'Rotación',
      'Valor Inventario', 'Ventas (30d)', 'Sell-Through %',
      'Cobertura (días)', 'Productos Únicos'
    ];
    
    const rows = locationAnalytics.map(data => [
      data.location.name,
      data.location.address?.city || 'N/A',
      data.location.isActive ? 'Activa' : 'Inactiva',
      data.inventory.available,
      data.sales.unitsSold,
      `${Math.round(data.kpis.turnoverRate * 100)}%`,
      `$${data.inventory.value.toFixed(2)}`,
      `$${data.sales.value.toFixed(2)}`,
      `${Math.round(data.kpis.sellThrough)}%`,
      data.kpis.stockCoverage > 365 ? '365+' : data.kpis.stockCoverage,
      data.inventory.uniqueProducts
    ]);
    
    const csvContent = [
      `Reporte de Análisis Multi-Sucursal - ${new Date().toLocaleDateString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      'Resumen General',
      `Total Sucursales,${totals.locations}`,
      `Inventario Total,${totals.inventory}`,
      `Unidades Vendidas (30d),${totals.sold}`,
      `Valor Total Inventario,$${totals.value.toFixed(2)}`,
      `Ventas Totales (30d),$${totals.sales.toFixed(2)}`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis-sucursales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  
  // Datos para el mapa de calor
  const heatmapData = locationAnalytics.map(data => ({
    name: data.location.name.substring(0, 3).toUpperCase(),
    full: data.location.name,
    efficiency: Math.round(data.kpis.sellThrough),
    sales: data.sales.value,
    inventory: data.inventory.value,
    x: Math.random() * 100,
    y: Math.random() * 100
  }));
  
  return (
    <s-page heading="Dashboard Multi-Sucursal">
      {/* Header con resumen rápido */}
      <s-section>
        <s-banner tone="info">
          <s-stack direction="inline" alignment="space-between">
            <s-text>
              <s-text emphasis="strong">{totals.locations} sucursales activas</s-text> monitoreadas en tiempo real
            </s-text>
            <s-text subdued size="small">
              Última actualización: {new Date(lastUpdate).toLocaleTimeString('es-DO')}
            </s-text>
          </s-stack>
        </s-banner>
      </s-section>
      
      {/* KPIs Principales con animación */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-stack direction="inline" alignment="space-between">
                  <s-heading size="small">Eficiencia General</s-heading>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: animatedTotals.efficiency > 50 ? '#36c98d' : '#ffb800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <s-text size="small" emphasis="bold" style={{ color: 'white' }}>📊</s-text>
                  </div>
                </s-stack>
                <s-text size="large" emphasis="bold">
                  {animatedTotals.efficiency}%
                </s-text>
                <s-text subdued>Sell-Through Rate (30 días)</s-text>
                <s-badge tone="info">
                  {totals.sold.toLocaleString()} vendidas / {totals.inventory.toLocaleString()} en stock
                </s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-stack direction="inline" alignment="space-between">
                  <s-heading size="small">Valor del Inventario</s-heading>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #008060 0%, #5630ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <s-text size="small" emphasis="bold" style={{ color: 'white' }}>💰</s-text>
                  </div>
                </s-stack>
                <s-text size="large" emphasis="bold">
                  ${animatedTotals.value.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </s-text>
                <s-text subdued>En {totals.locations} sucursales activas</s-text>
                <s-badge tone="warning">
                  ${(totals.value / totals.locations).toLocaleString()} promedio
                </s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-stack direction="inline" alignment="space-between">
                  <s-heading size="small">Ventas (30 días)</s-heading>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#5630ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <s-text size="small" emphasis="bold" style={{ color: 'white' }}>🛒</s-text>
                  </div>
                </s-stack>
                <s-text size="large" emphasis="bold">
                  ${animatedTotals.sales.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </s-text>
                <s-text subdued>{totals.sold.toLocaleString()} unidades vendidas</s-text>
                <s-badge tone="success">
                  ${(totals.sales / totals.sold).toFixed(2)} ticket promedio
                </s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Mapa de calor de sucursales */}
      <s-section>
        <s-card>
          <s-heading>Mapa de Performance por Sucursal</s-heading>
          <s-text subdued>Tamaño = Ventas | Color = Eficiencia</s-text>
          <div style={{ width: '100%', height: 350, marginTop: 20, position: 'relative' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px',
              padding: '20px'
            }}>
              {heatmapData.map((location, index) => {
                const size = 60 + (location.sales / Math.max(...heatmapData.map(d => d.sales))) * 40;
                const opacity = 0.6 + (location.efficiency / 100) * 0.4;
                const color = location.efficiency > 70 ? '#36c98d' : location.efficiency > 40 ? '#ffb800' : '#d83c3e';
                
                return (
                  <div
                    key={index}
                    onClick={() => navigate(`/app/sucursal/${locationAnalytics[index].location.id.split('/').pop()}`)}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: '10px',
                      background: color,
                      opacity,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      margin: '0 auto',
                      ':hover': {
                        transform: 'scale(1.05)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <s-text emphasis="strong" style={{ color: 'white', fontSize: '14px' }}>
                      {location.name}
                    </s-text>
                    <s-text style={{ color: 'white', fontSize: '12px' }}>
                      {location.efficiency}%
                    </s-text>
                  </div>
                );
              })}
            </div>
          </div>
        </s-card>
      </s-section>
      
      {/* Comparativa Ventas vs Inventario mejorada */}
      <s-section>
        <s-card>
          <s-stack direction="inline" alignment="space-between">
            <s-heading>Ventas vs Inventario por Sucursal</s-heading>
            <s-stack direction="inline" gap="tight">
              <s-badge tone="info">30 días</s-badge>
              <s-button variant="tertiary" size="small" onClick={() => navigate('/app/analytics')}>
                Ver más
              </s-button>
            </s-stack>
          </s-stack>
          <div style={{ width: '100%', height: 400, marginTop: 20 }}>
            <ResponsiveContainer>
              <ComposedChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#5630ff" />
                <YAxis yAxisId="right" orientation="right" stroke="#008060" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="vendidas" fill="#5630ff" name="Unidades Vendidas (30d)" />
                <Bar yAxisId="left" dataKey="inventario" fill="#008060" name="Inventario Actual" />
                <Bar yAxisId="right" dataKey="rotacion" fill="#e3b505" name="Rotación %" />
                <Area yAxisId="right" type="monotone" dataKey="rotacion" fill="#e3b505" stroke="#e3b505" fillOpacity={0.3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </s-card>
      </s-section>
      
      {/* Tabla Detallada de Sucursales */}
      <s-section>
        <s-card>
          <s-stack direction="inline" alignment="space-between">
            <s-heading>Análisis Detallado por Sucursal</s-heading>
            <s-stack direction="inline" gap="tight">
              <s-button onClick={exportDetailedReport}>
                Exportar Reporte
              </s-button>
              <s-button variant="secondary" onClick={() => window.location.reload()}>
                Actualizar
              </s-button>
            </s-stack>
          </s-stack>
          
          <s-table style={{ marginTop: '1rem' }}>
            <s-table-head>
              <s-table-row>
                <s-table-header>Sucursal</s-table-header>
                <s-table-header>Inventario</s-table-header>
                <s-table-header>Vendidas (30d)</s-table-header>
                <s-table-header>Rotación</s-table-header>
                <s-table-header>Sell-Through</s-table-header>
                <s-table-header>Cobertura</s-table-header>
                <s-table-header>Valor Inv.</s-table-header>
                <s-table-header>Ventas (30d)</s-table-header>
                <s-table-header>Acciones</s-table-header>
              </s-table-row>
            </s-table-head>
            <s-table-body>
              {locationAnalytics.map((data, index) => (
                <s-table-row key={index}>
                  <s-table-cell>
                    <s-stack gap="extra-tight">
                      <s-text emphasis="strong">{data.location.name}</s-text>
                      <s-text size="small" subdued>{data.location.address?.city || 'N/A'}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={data.inventory.available < 100 ? 'critical' : 'success'}>
                      {data.inventory.available.toLocaleString()}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{data.sales.unitsSold.toLocaleString()}</s-table-cell>
                  <s-table-cell>
                    <s-badge 
                      tone={data.kpis.turnoverRate > 0.5 ? 'success' : data.kpis.turnoverRate > 0.25 ? 'warning' : 'critical'}
                    >
                      {Math.round(data.kpis.turnoverRate * 100)}%
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text emphasis={data.kpis.sellThrough > 50 ? 'strong' : undefined}>
                      {Math.round(data.kpis.sellThrough)}%
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={data.kpis.stockCoverage > 60 ? 'warning' : 'info'}>
                      {data.kpis.stockCoverage > 365 ? '365+' : data.kpis.stockCoverage} días
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    ${data.inventory.value.toLocaleString('es-DO', { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 0 
                    })}
                  </s-table-cell>
                  <s-table-cell>
                    <s-text emphasis="strong">
                      ${data.sales.value.toLocaleString('es-DO', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                      })}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button 
                      variant="tertiary" 
                      size="small"
                      onClick={() => navigate(`/app/location/${data.location.id.split('/').pop()}`)}
                    >
                      Analizar
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-card>
      </s-section>
      
      {/* Radar de Eficiencia */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-half">
            <s-card>
              <s-heading>Indicadores de Eficiencia</s-heading>
              <div style={{ width: '100%', height: 350, marginTop: 20 }}>
                <ResponsiveContainer>
                  <RadarChart data={efficiencyData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Sell-Through %" dataKey="sellThrough" stroke="#5630ff" fill="#5630ff" fillOpacity={0.6} />
                    <Radar name="Rotación %" dataKey="turnover" stroke="#008060" fill="#008060" fillOpacity={0.6} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-half">
            <s-card>
              <s-heading>Alertas y Recomendaciones</s-heading>
              <s-stack gap="base">
                {locationAnalytics
                  .filter(data => 
                    data.kpis.turnoverRate < 0.25 || 
                    data.inventory.available < 50 || 
                    data.kpis.stockCoverage > 90
                  )
                  .map((data, index) => (
                    <s-banner 
                      key={index}
                      tone={data.inventory.available < 50 ? 'critical' : 'warning'}
                    >
                      <s-text emphasis="strong">{data.location.name}</s-text>
                      {data.inventory.available < 50 && (
                        <s-text> - Stock crítico: Solo {data.inventory.available} unidades</s-text>
                      )}
                      {data.kpis.turnoverRate < 0.25 && (
                        <s-text> - Baja rotación: {Math.round(data.kpis.turnoverRate * 100)}%</s-text>
                      )}
                      {data.kpis.stockCoverage > 90 && (
                        <s-text> - Sobrestock: Cobertura de {data.kpis.stockCoverage} días</s-text>
                      )}
                    </s-banner>
                  ))
                }
                {locationAnalytics.filter(data => 
                  data.kpis.turnoverRate < 0.25 || 
                  data.inventory.available < 50 || 
                  data.kpis.stockCoverage > 90
                ).length === 0 && (
                  <s-banner tone="success">
                    Todas las sucursales operando con métricas saludables
                  </s-banner>
                )}
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Footer con última actualización */}
      <s-section slot="aside" heading="Información">
        <s-text size="small" subdued>
          Última actualización: {new Date(lastUpdate).toLocaleString('es-DO')}
        </s-text>
        <s-text size="small" subdued>
          Período de análisis: Últimos 30 días
        </s-text>
      </s-section>
    </s-page>
  );
}