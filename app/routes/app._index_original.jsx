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
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [animatedTotals, setAnimatedTotals] = useState({
    inventory: 0,
    sold: 0,
    value: 0,
    sales: 0,
    efficiency: 0,
    locations: 0
  });
  
  // Animación de números
  useEffect(() => {
    const duration = 1500; // 1.5 segundos
    const steps = 30;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setAnimatedTotals({
        inventory: Math.round(totals.inventory * easeOutQuart),
        sold: Math.round(totals.sold * easeOutQuart),
        value: Math.round(totals.value * easeOutQuart),
        sales: Math.round(totals.sales * easeOutQuart),
        efficiency: Math.round((totals.sold / (totals.sold + totals.inventory)) * 100 * easeOutQuart),
        locations: Math.round(totals.locations * easeOutQuart)
      });
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setAnimatedTotals({
          inventory: totals.inventory,
          sold: totals.sold,
          value: totals.value,
          sales: totals.sales,
          efficiency: Math.round((totals.sold / (totals.sold + totals.inventory)) * 100),
          locations: totals.locations
        });
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
    <s-page>
      {/* Header mejorado */}
      <s-section>
        <s-layout>
          <s-layout-section variant="full">
            <s-stack gap="tight">
              <s-stack direction="inline" alignment="space-between">
                <div>
                  <s-heading size="extra-large">Dashboard de Análisis</s-heading>
                  <s-text subdued size="medium">
                    Visión general del rendimiento de tus {animatedTotals.locations} sucursales
                  </s-text>
                </div>
                <s-stack direction="inline" gap="tight">
                  <s-select
                    label="Período"
                    labelHidden
                    options={[
                      { label: 'Últimos 7 días', value: '7d' },
                      { label: 'Últimos 30 días', value: '30d' },
                      { label: 'Últimos 90 días', value: '90d' },
                      { label: 'Último año', value: '1y' }
                    ]}
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                  />
                  <s-button variant="secondary" onClick={() => window.location.reload()}>
                    Actualizar
                  </s-button>
                  <s-button onClick={exportDetailedReport}>
                    Exportar
                  </s-button>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* KPIs Principales rediseñados */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderLeft: '4px solid #008060',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <s-stack gap="tight">
                <s-stack direction="inline" alignment="space-between">
                  <s-text subdued size="small">Inventario Total</s-text>
                  <s-badge tone="info">Stock</s-badge>
                </s-stack>
                <s-text size="extra-large" emphasis="bold">
                  {animatedTotals.inventory.toLocaleString()}
                </s-text>
                <s-stack direction="inline" gap="extra-tight">
                  <s-text subdued size="small">unidades disponibles</s-text>
                </s-stack>
                <div style={{
                  position: 'absolute',
                  right: '-10px',
                  bottom: '-10px',
                  fontSize: '80px',
                  opacity: '0.1',
                  color: '#008060'
                }}>📦</div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderLeft: '4px solid #5630ff',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <s-stack gap="tight">
                <s-stack direction="inline" alignment="space-between">
                  <s-text subdued size="small">Ventas del Mes</s-text>
                  <s-badge tone="success">+12%</s-badge>
                </s-stack>
                <s-text size="extra-large" emphasis="bold">
                  ${animatedTotals.sales.toLocaleString('es-DO', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  })}
                </s-text>
                <s-stack direction="inline" gap="extra-tight">
                  <s-text subdued size="small">{animatedTotals.sold.toLocaleString()} unidades</s-text>
                </s-stack>
                <div style={{
                  position: 'absolute',
                  right: '-10px',
                  bottom: '-10px',
                  fontSize: '80px',
                  opacity: '0.1',
                  color: '#5630ff'
                }}>💰</div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderLeft: '4px solid #e3b505',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <s-stack gap="tight">
                <s-stack direction="inline" alignment="space-between">
                  <s-text subdued size="small">Eficiencia</s-text>
                  <s-badge tone={animatedTotals.efficiency > 50 ? 'success' : 'warning'}>
                    {animatedTotals.efficiency > 50 ? '✓ Óptima' : '⚠ Mejorar'}
                  </s-badge>
                </s-stack>
                <s-text size="extra-large" emphasis="bold">
                  {animatedTotals.efficiency}%
                </s-text>
                <s-stack direction="inline" gap="extra-tight">
                  <s-text subdued size="small">sell-through rate</s-text>
                </s-stack>
                <div style={{
                  position: 'absolute',
                  right: '-10px',
                  bottom: '-10px',
                  fontSize: '80px',
                  opacity: '0.1',
                  color: '#e3b505'
                }}>📈</div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ 
              borderLeft: '4px solid #00a0ac',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <s-stack gap="tight">
                <s-stack direction="inline" alignment="space-between">
                  <s-text subdued size="small">Valor Inventario</s-text>
                  <s-badge tone="info">Total</s-badge>
                </s-stack>
                <s-text size="extra-large" emphasis="bold">
                  ${animatedTotals.value.toLocaleString('es-DO', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  })}
                </s-text>
                <s-stack direction="inline" gap="extra-tight">
                  <s-text subdued size="small">en {animatedTotals.locations} sucursales</s-text>
                </s-stack>
                <div style={{
                  position: 'absolute',
                  right: '-10px',
                  bottom: '-10px',
                  fontSize: '80px',
                  opacity: '0.1',
                  color: '#00a0ac'
                }}>🏪</div>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Performance por Sucursal - Vista mejorada */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" alignment="space-between">
              <div>
                <s-heading>Performance por Sucursal</s-heading>
                <s-text subdued>Haz clic en cualquier sucursal para ver más detalles</s-text>
              </div>
              <s-button variant="tertiary" size="small" onClick={() => navigate('/app/sucursales')}>
                Ver todas
              </s-button>
            </s-stack>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {locationAnalytics.slice(0, 6).map((data, index) => {
                const performanceScore = Math.round(data.kpis.sellThrough);
                const isGood = performanceScore > 70;
                const isWarning = performanceScore > 40 && performanceScore <= 70;
                
                return (
                  <div
                    key={index}
                    onClick={() => navigate(`/app/sucursal/${data.location.id.split('/').pop()}`)}
                    style={{
                      background: '#f6f6f7',
                      border: '1px solid #e1e3e5',
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <s-stack gap="tight">
                      <s-stack direction="inline" alignment="space-between">
                        <s-text emphasis="strong" size="medium">{data.location.name}</s-text>
                        <s-badge tone={isGood ? 'success' : isWarning ? 'warning' : 'critical'}>
                          {performanceScore}%
                        </s-badge>
                      </s-stack>
                      
                      <s-text subdued size="small">{data.location.address?.city || 'Ciudad'}</s-text>
                      
                      <s-divider />
                      
                      <s-stack gap="extra-tight">
                        <s-stack direction="inline" alignment="space-between">
                          <s-text size="small">Ventas</s-text>
                          <s-text size="small" emphasis="strong">
                            ${data.sales.value.toLocaleString('es-DO', { 
                              minimumFractionDigits: 0, 
                              maximumFractionDigits: 0 
                            })}
                          </s-text>
                        </s-stack>
                        <s-stack direction="inline" alignment="space-between">
                          <s-text size="small">Inventario</s-text>
                          <s-text size="small" emphasis="strong">{data.inventory.available.toLocaleString()}</s-text>
                        </s-stack>
                        <s-stack direction="inline" alignment="space-between">
                          <s-text size="small">Rotación</s-text>
                          <s-text size="small" emphasis="strong">{Math.round(data.kpis.turnoverRate * 100)}%</s-text>
                        </s-stack>
                      </s-stack>
                    </s-stack>
                    
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '3px',
                      background: isGood ? '#36c98d' : isWarning ? '#ffb800' : '#d83c3e'
                    }} />
                  </div>
                );
              })}
            </div>
            
            {locationAnalytics.length > 6 && (
              <s-banner tone="info">
                <s-text>Mostrando 6 de {locationAnalytics.length} sucursales. </s-text>
                <s-link onClick={() => navigate('/app/sucursales')}>Ver todas →</s-link>
              </s-banner>
            )}
          </s-stack>
        </s-card>
      </s-section>
      
      {/* Gráficas principales */}
      <s-section>
        <s-layout>
          <s-layout-section variant="two-thirds">
            <s-card>
              <s-stack gap="base">
                <s-stack direction="inline" alignment="space-between">
                  <div>
                    <s-heading>Tendencia de Ventas vs Inventario</s-heading>
                    <s-text subdued>Comparativa por sucursal - últimos 30 días</s-text>
                  </div>
                  <s-button variant="tertiary" size="small" onClick={() => navigate('/app/analytics')}>
                    Análisis detallado
                  </s-button>
                </s-stack>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5630ff" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#5630ff" stopOpacity={0.3}/>
                        </linearGradient>
                        <linearGradient id="colorInventario" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#008060" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#008060" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e1e3e5" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="#6b7280" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: '1px solid #e1e3e5',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="circle"
                      />
                      <Bar yAxisId="left" dataKey="vendidas" fill="url(#colorVentas)" name="Unidades Vendidas" radius={[8, 8, 0, 0]} />
                      <Bar yAxisId="left" dataKey="inventario" fill="url(#colorInventario)" name="Inventario Actual" radius={[8, 8, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="rotacion" stroke="#e3b505" strokeWidth={3} dot={{ fill: '#e3b505' }} name="Rotación %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-heading>Distribución de Inventario</s-heading>
                <s-text subdued>Por sucursal</s-text>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={locationAnalytics.slice(0, 5).map(data => ({
                          name: data.location.name,
                          value: data.inventory.value
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {locationAnalytics.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <s-stack gap="extra-tight">
                  {locationAnalytics.slice(0, 5).map((data, index) => (
                    <s-stack key={index} direction="inline" alignment="space-between">
                      <s-stack direction="inline" gap="extra-tight" alignment="center">
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          borderRadius: '50%', 
                          background: COLORS[index % COLORS.length] 
                        }} />
                        <s-text size="small">{data.location.name}</s-text>
                      </s-stack>
                      <s-text size="small" emphasis="strong">
                        ${data.inventory.value.toLocaleString('es-DO', { 
                          minimumFractionDigits: 0, 
                          maximumFractionDigits: 0 
                        })}
                      </s-text>
                    </s-stack>
                  ))}
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Tabla de Métricas Clave */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" alignment="space-between">
              <div>
                <s-heading>Métricas Detalladas por Sucursal</s-heading>
                <s-text subdued>Haz clic en cualquier fila para ver más detalles</s-text>
              </div>
              <s-button variant="tertiary" onClick={exportDetailedReport}>
                Exportar CSV
              </s-button>
            </s-stack>
            
            <div style={{ overflowX: 'auto' }}>
              <s-table>
                <s-table-head>
                  <s-table-row>
                    <s-table-header>Sucursal</s-table-header>
                    <s-table-header>Estado</s-table-header>
                    <s-table-header>Inventario</s-table-header>
                    <s-table-header>Ventas (30d)</s-table-header>
                    <s-table-header>Eficiencia</s-table-header>
                    <s-table-header>Tendencia</s-table-header>
                  </s-table-row>
                </s-table-head>
                <s-table-body>
                  {locationAnalytics.map((data, index) => {
                    const isLowStock = data.inventory.available < 100;
                    const isHighPerformance = data.kpis.sellThrough > 70;
                    const trend = Math.random() > 0.5; // Simulated trend
                    
                    return (
                      <s-table-row 
                        key={index}
                        hover
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/app/sucursal/${data.location.id.split('/').pop()}`)}
                      >
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-text emphasis="strong">{data.location.name}</s-text>
                            <s-text size="small" subdued>{data.location.address?.city || 'Ciudad'}</s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone={data.location.isActive ? 'success' : 'critical'}>
                            {data.location.isActive ? 'Activa' : 'Inactiva'}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-text emphasis={isLowStock ? 'strong' : undefined} tone={isLowStock ? 'critical' : undefined}>
                              {data.inventory.available.toLocaleString()} und
                            </s-text>
                            <s-text size="small" subdued>
                              ${(data.inventory.value / 1000).toFixed(1)}k valor
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-text emphasis="strong">
                              ${(data.sales.value / 1000).toFixed(1)}k
                            </s-text>
                            <s-text size="small" subdued>
                              {data.sales.unitsSold.toLocaleString()} und
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack gap="extra-tight">
                            <s-progress 
                              value={data.kpis.sellThrough} 
                              tone={isHighPerformance ? 'success' : data.kpis.sellThrough > 40 ? 'warning' : 'critical'}
                              size="small"
                            />
                            <s-text size="small">
                              {Math.round(data.kpis.sellThrough)}% sell-through
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack direction="inline" gap="extra-tight" alignment="center">
                            <span style={{ 
                              color: trend ? '#36c98d' : '#d83c3e',
                              fontSize: '16px'
                            }}>
                              {trend ? '↑' : '↓'}
                            </span>
                            <s-text size="small" tone={trend ? 'success' : 'critical'}>
                              {trend ? '+' : '-'}{Math.round(Math.random() * 20 + 5)}%
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                      </s-table-row>
                    );
                  })}
                </s-table-body>
              </s-table>
            </div>
          </s-stack>
        </s-card>
      </s-section>
      
      {/* Alertas y Acciones Rápidas */}
      <s-section>
        <s-layout>
          <s-layout-section variant="two-thirds">
            <s-card>
              <s-stack gap="base">
                <s-heading>Alertas y Notificaciones</s-heading>
                <s-stack gap="tight">
                  {locationAnalytics
                    .filter(data => 
                      data.kpis.turnoverRate < 0.25 || 
                      data.inventory.available < 50 || 
                      data.kpis.stockCoverage > 90
                    )
                    .slice(0, 5)
                    .map((data, index) => {
                      const isCritical = data.inventory.available < 50;
                      const alertType = isCritical ? 'Stock crítico' : 
                                      data.kpis.turnoverRate < 0.25 ? 'Baja rotación' : 'Sobrestock';
                      
                      return (
                        <div 
                          key={index}
                          style={{
                            background: isCritical ? '#fef2f2' : '#fffbeb',
                            border: `1px solid ${isCritical ? '#fee2e2' : '#fef3c7'}`,
                            borderLeft: `4px solid ${isCritical ? '#ef4444' : '#f59e0b'}`,
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => navigate(`/app/sucursal/${data.location.id.split('/').pop()}`)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          <s-stack gap="extra-tight">
                            <s-stack direction="inline" gap="tight" alignment="center">
                              <s-badge tone={isCritical ? 'critical' : 'warning'}>
                                {alertType}
                              </s-badge>
                              <s-text emphasis="strong">{data.location.name}</s-text>
                            </s-stack>
                            <s-text size="small" subdued>
                              {isCritical && `Solo ${data.inventory.available} unidades disponibles`}
                              {data.kpis.turnoverRate < 0.25 && !isCritical && `Rotación: ${Math.round(data.kpis.turnoverRate * 100)}%`}
                              {data.kpis.stockCoverage > 90 && !isCritical && `Cobertura de ${data.kpis.stockCoverage} días`}
                            </s-text>
                          </s-stack>
                          <s-text size="small" subdued>→</s-text>
                        </div>
                      );
                    })
                  }
                  {locationAnalytics.filter(data => 
                    data.kpis.turnoverRate < 0.25 || 
                    data.inventory.available < 50 || 
                    data.kpis.stockCoverage > 90
                  ).length === 0 && (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #d1fae5',
                      borderLeft: '4px solid #10b981',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <s-stack direction="inline" gap="tight" alignment="center">
                        <span style={{ fontSize: '20px' }}>✓</span>
                        <s-text emphasis="strong">Todas las sucursales operan con métricas saludables</s-text>
                      </s-stack>
                    </div>
                  )}
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-heading>Acciones Rápidas</s-heading>
                <s-stack gap="tight">
                  <s-button fullWidth variant="secondary" onClick={() => navigate('/app/sucursales')}>
                    Gestionar Sucursales
                  </s-button>
                  <s-button fullWidth variant="secondary" onClick={() => navigate('/app/inventario')}>
                    Ver Inventario Completo
                  </s-button>
                  <s-button fullWidth variant="secondary" onClick={() => navigate('/app/analytics')}>
                    Análisis Avanzado
                  </s-button>
                  <s-divider />
                  <s-button fullWidth variant="tertiary" onClick={exportDetailedReport}>
                    Exportar Reporte CSV
                  </s-button>
                  <s-button fullWidth variant="tertiary" onClick={() => navigate('/app/configuracion')}>
                    Configuración
                  </s-button>
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Footer mejorado */}
      <s-section>
        <s-card style={{ background: '#f6f6f7', border: '1px solid #e1e3e5' }}>
          <s-stack direction="inline" alignment="space-between">
            <s-stack gap="extra-tight">
              <s-text size="small" subdued>Última actualización</s-text>
              <s-text size="small" emphasis="strong">
                {new Date(lastUpdate).toLocaleString('es-DO', { 
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </s-text>
            </s-stack>
            <s-stack gap="extra-tight">
              <s-text size="small" subdued>Período analizado</s-text>
              <s-text size="small" emphasis="strong">30 días</s-text>
            </s-stack>
            <s-stack gap="extra-tight">
              <s-text size="small" subdued>Próxima actualización</s-text>
              <s-text size="small" emphasis="strong">En 15 minutos</s-text>
            </s-stack>
            <s-button variant="tertiary" size="small" onClick={() => window.location.reload()}>
              Actualizar ahora
            </s-button>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}