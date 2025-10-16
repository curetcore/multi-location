import { useState, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ScatterChart, Scatter
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
                }
              }
            }
          }
        }
      `
    );
    
    const locationsData = await locationsResponse.json();
    const locations = locationsData.data?.locations?.edges || [];
    
    // Simular datos históricos para análisis (en producción vendrían de una DB)
    const today = new Date();
    const last90Days = [];
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      last90Days.push({
        date: date.toISOString().split('T')[0],
        sales: Math.round((Math.random() * 50000 + 30000) * (1 + (89-i)/100)),
        orders: Math.round(Math.random() * 200 + 100),
        inventory: Math.round(Math.random() * 5000 + 15000),
        newCustomers: Math.round(Math.random() * 50 + 20)
      });
    }
    
    // Análisis por ubicación con más métricas
    const locationAnalytics = await Promise.all(
      locations.map(async ({ node: location }) => {
        // Datos simulados más complejos
        const monthlySales = Array.from({ length: 12 }, (_, i) => ({
          month: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
          sales: Math.round(Math.random() * 100000 + 50000),
          orders: Math.round(Math.random() * 500 + 200),
          avgTicket: Math.round(Math.random() * 200 + 100)
        }));
        
        const productPerformance = Array.from({ length: 10 }, (_, i) => ({
          product: `Producto ${i + 1}`,
          sales: Math.round(Math.random() * 50000 + 10000),
          quantity: Math.round(Math.random() * 500 + 100),
          margin: Math.round(Math.random() * 40 + 20)
        }));
        
        return {
          location,
          monthlySales,
          productPerformance,
          metrics: {
            totalSales: monthlySales.reduce((sum, m) => sum + m.sales, 0),
            avgMonthlyGrowth: Math.round(Math.random() * 20 - 5),
            customerRetention: Math.round(Math.random() * 30 + 60),
            avgOrderValue: Math.round(Math.random() * 100 + 150),
            conversionRate: (Math.random() * 3 + 1).toFixed(2)
          }
        };
      })
    );
    
    return {
      locations,
      locationAnalytics,
      historicalData: last90Days,
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Error loading analytics:", error);
    return {
      locations: [],
      locationAnalytics: [],
      historicalData: [],
      lastUpdate: new Date().toISOString()
    };
  }
};

const COLORS = ['#008060', '#5630ff', '#e3b505', '#ee5737', '#00a0ac', '#50b83c', '#9c6ade', '#f49342'];

export default function Analytics() {
  const { locations, locationAnalytics, historicalData, lastUpdate } = useLoaderData();
  const navigate = useNavigate();
  
  const [selectedPeriod, setSelectedPeriod] = useState('90d');
  const [selectedMetric, setSelectedMetric] = useState('sales');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState([]);
  
  // Procesar datos según período seleccionado
  const getFilteredData = () => {
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    return historicalData.slice(-days);
  };
  
  const filteredData = getFilteredData();
  
  // Calcular totales y tendencias
  const calculateTrends = () => {
    const current = filteredData.slice(-7).reduce((sum, d) => sum + d[selectedMetric], 0);
    const previous = filteredData.slice(-14, -7).reduce((sum, d) => sum + d[selectedMetric], 0);
    const change = ((current - previous) / previous) * 100;
    
    return {
      current,
      change: change.toFixed(1),
      isPositive: change > 0
    };
  };
  
  const trends = calculateTrends();
  
  // Preparar datos para comparación entre sucursales
  const comparisonData = locationAnalytics.map(data => ({
    name: data.location.name,
    ventas: data.metrics.totalSales,
    crecimiento: data.metrics.avgMonthlyGrowth,
    retencion: data.metrics.customerRetention,
    conversion: parseFloat(data.metrics.conversionRate)
  }));
  
  // Datos para el funnel de conversión
  const funnelData = [
    { name: 'Visitantes', value: 10000, fill: '#008060' },
    { name: 'Agregaron al carrito', value: 3500, fill: '#5630ff' },
    { name: 'Iniciaron checkout', value: 2000, fill: '#e3b505' },
    { name: 'Compraron', value: 1500, fill: '#00a0ac' }
  ];
  
  return (
    <s-page>
      {/* Header */}
      <s-section>
        <s-layout>
          <s-layout-section variant="full">
            <s-stack gap="tight">
              <s-stack direction="inline" alignment="space-between">
                <div>
                  <s-heading size="extra-large">Centro de Analytics</s-heading>
                  <s-text subdued size="medium">
                    Análisis detallado del rendimiento de tu negocio
                  </s-text>
                </div>
                <s-stack direction="inline" gap="tight">
                  <s-select
                    label="Período"
                    labelHidden
                    options={[
                      { label: 'Últimos 7 días', value: '7d' },
                      { label: 'Últimos 30 días', value: '30d' },
                      { label: 'Últimos 90 días', value: '90d' }
                    ]}
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                  />
                  <s-button variant="secondary" onClick={() => setCompareMode(!compareMode)}>
                    {compareMode ? 'Ver individual' : 'Comparar sucursales'}
                  </s-button>
                  <s-button onClick={() => navigate('/app/analytics/reportes')}>
                    Crear reporte
                  </s-button>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* KPIs principales con tendencias */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-quarter">
            <s-card 
              style={{ 
                borderTop: '3px solid #008060',
                cursor: 'pointer',
                background: selectedMetric === 'sales' ? '#f0fdf4' : 'white'
              }}
              onClick={() => setSelectedMetric('sales')}
            >
              <s-stack gap="tight">
                <s-text subdued size="small">Ventas Totales</s-text>
                <s-text size="large" emphasis="bold">
                  ${(trends.current / 1000).toFixed(1)}k
                </s-text>
                <s-stack direction="inline" gap="extra-tight" alignment="center">
                  <span style={{ 
                    color: trends.isPositive ? '#36c98d' : '#d83c3e',
                    fontSize: '16px'
                  }}>
                    {trends.isPositive ? '↑' : '↓'}
                  </span>
                  <s-text size="small" tone={trends.isPositive ? 'success' : 'critical'}>
                    {Math.abs(trends.change)}% vs período anterior
                  </s-text>
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card 
              style={{ 
                borderTop: '3px solid #5630ff',
                cursor: 'pointer',
                background: selectedMetric === 'orders' ? '#f3f0ff' : 'white'
              }}
              onClick={() => setSelectedMetric('orders')}
            >
              <s-stack gap="tight">
                <s-text subdued size="small">Órdenes</s-text>
                <s-text size="large" emphasis="bold">
                  {filteredData.reduce((sum, d) => sum + d.orders, 0).toLocaleString()}
                </s-text>
                <s-text size="small" subdued>
                  Promedio: {Math.round(filteredData.reduce((sum, d) => sum + d.orders, 0) / filteredData.length)}/día
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ borderTop: '3px solid #e3b505' }}>
              <s-stack gap="tight">
                <s-text subdued size="small">Ticket Promedio</s-text>
                <s-text size="large" emphasis="bold">
                  ${Math.round(trends.current / filteredData.reduce((sum, d) => sum + d.orders, 0))}
                </s-text>
                <s-badge tone="success">+5.2% mes</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card style={{ borderTop: '3px solid #00a0ac' }}>
              <s-stack gap="tight">
                <s-text subdued size="small">Nuevos Clientes</s-text>
                <s-text size="large" emphasis="bold">
                  {filteredData.reduce((sum, d) => sum + d.newCustomers, 0).toLocaleString()}
                </s-text>
                <s-text size="small" subdued>
                  +{Math.round(filteredData.reduce((sum, d) => sum + d.newCustomers, 0) / filteredData.length)}/día promedio
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Gráfica principal de tendencias */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" alignment="space-between">
              <div>
                <s-heading>Tendencia de {selectedMetric === 'sales' ? 'Ventas' : 'Órdenes'}</s-heading>
                <s-text subdued>Últimos {selectedPeriod === '7d' ? '7 días' : selectedPeriod === '30d' ? '30 días' : '90 días'}</s-text>
              </div>
              <s-stack direction="inline" gap="tight">
                <s-badge tone="info">
                  Total: ${filteredData.reduce((sum, d) => sum + d[selectedMetric], 0).toLocaleString()}
                </s-badge>
              </s-stack>
            </s-stack>
            
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#008060" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#008060" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e3e5" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e1e3e5',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => selectedMetric === 'sales' ? `$${value.toLocaleString()}` : value.toLocaleString()}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={selectedMetric} 
                    stroke="#008060" 
                    fill="url(#colorGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </s-stack>
        </s-card>
      </s-section>
      
      {/* Comparación entre sucursales */}
      <s-section>
        <s-layout>
          <s-layout-section variant="two-thirds">
            <s-card>
              <s-stack gap="base">
                <s-heading>Comparación entre Sucursales</s-heading>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <RadarChart data={comparisonData}>
                      <PolarGrid stroke="#e1e3e5" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar 
                        name="Retención %" 
                        dataKey="retencion" 
                        stroke="#008060" 
                        fill="#008060" 
                        fillOpacity={0.6} 
                      />
                      <Radar 
                        name="Conversión %" 
                        dataKey="conversion" 
                        stroke="#5630ff" 
                        fill="#5630ff" 
                        fillOpacity={0.6} 
                      />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-third">
            <s-card>
              <s-stack gap="base">
                <s-heading>Funnel de Conversión</s-heading>
                <s-text subdued>Promedio últimos 30 días</s-text>
                <s-stack gap="tight">
                  {funnelData.map((stage, index) => (
                    <div key={index}>
                      <s-stack direction="inline" alignment="space-between">
                        <s-text size="small">{stage.name}</s-text>
                        <s-text size="small" emphasis="strong">{stage.value.toLocaleString()}</s-text>
                      </s-stack>
                      <div style={{
                        height: '24px',
                        background: '#f6f6f7',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginTop: '4px'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(stage.value / funnelData[0].value) * 100}%`,
                          background: stage.fill,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                      {index < funnelData.length - 1 && (
                        <s-text size="small" subdued style={{ marginTop: '4px' }}>
                          {((stage.value / funnelData[0].value) * 100).toFixed(1)}% continúan
                        </s-text>
                      )}
                    </div>
                  ))}
                </s-stack>
                <s-divider />
                <s-stack gap="extra-tight">
                  <s-text size="small" subdued>Tasa de conversión final</s-text>
                  <s-text size="large" emphasis="bold">
                    {((funnelData[funnelData.length - 1].value / funnelData[0].value) * 100).toFixed(2)}%
                  </s-text>
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Análisis de productos */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-half">
            <s-card>
              <s-stack gap="base">
                <s-heading>Top 10 Productos por Ventas</s-heading>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <BarChart 
                      data={locationAnalytics[0]?.productPerformance || []}
                      layout="horizontal"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="product" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="sales" fill="#5630ff" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-half">
            <s-card>
              <s-stack gap="base">
                <s-heading>Distribución de Ventas por Categoría</s-heading>
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Electrónica', value: 35 },
                          { name: 'Ropa', value: 25 },
                          { name: 'Hogar', value: 20 },
                          { name: 'Alimentos', value: 15 },
                          { name: 'Otros', value: 5 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[0, 1, 2, 3, 4].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <s-stack gap="extra-tight">
                  {['Electrónica', 'Ropa', 'Hogar', 'Alimentos', 'Otros'].map((cat, index) => (
                    <s-stack key={index} direction="inline" alignment="space-between">
                      <s-stack direction="inline" gap="extra-tight" alignment="center">
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          borderRadius: '50%', 
                          background: COLORS[index % COLORS.length] 
                        }} />
                        <s-text size="small">{cat}</s-text>
                      </s-stack>
                      <s-text size="small" emphasis="strong">
                        {[35, 25, 20, 15, 5][index]}%
                      </s-text>
                    </s-stack>
                  ))}
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Acciones y exportación */}
      <s-section>
        <s-card style={{ background: '#f6f6f7' }}>
          <s-layout>
            <s-layout-section variant="one-half">
              <s-stack gap="tight">
                <s-heading size="small">Herramientas de Análisis</s-heading>
                <s-stack direction="inline" gap="tight">
                  <s-button variant="secondary" onClick={() => navigate('/app/analytics/comparador')}>
                    Comparador de períodos
                  </s-button>
                  <s-button variant="secondary" onClick={() => navigate('/app/analytics/predicciones')}>
                    Predicciones
                  </s-button>
                  <s-button variant="secondary" onClick={() => navigate('/app/analytics/alertas')}>
                    Configurar alertas
                  </s-button>
                </s-stack>
              </s-stack>
            </s-layout-section>
            
            <s-layout-section variant="one-half">
              <s-stack gap="tight" alignment="end">
                <s-heading size="small">Exportar Datos</s-heading>
                <s-stack direction="inline" gap="tight">
                  <s-button variant="tertiary">
                    Exportar CSV
                  </s-button>
                  <s-button variant="tertiary">
                    Exportar PDF
                  </s-button>
                  <s-button variant="tertiary">
                    Programar reporte
                  </s-button>
                </s-stack>
              </s-stack>
            </s-layout-section>
          </s-layout>
        </s-card>
      </s-section>
    </s-page>
  );
}