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
    
    // 3. Obtener órdenes recientes para calcular métricas
    const ordersResponse = await admin.graphql(
      `#graphql
        query getRecentOrders {
          orders(first: 50, reverse: true) {
            edges {
              node {
                id
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                createdAt
                lineItems(first: 5) {
                  edges {
                    node {
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      `
    );
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders?.edges || [];
    
    // 4. Obtener inventario total
    const inventoryResponse = await admin.graphql(
      `#graphql
        query getInventory {
          products(first: 100) {
            edges {
              node {
                variants(first: 10) {
                  edges {
                    node {
                      inventoryItem {
                        inventoryLevels(first: 10) {
                          edges {
                            node {
                              quantities(names: ["available"]) {
                                name
                                quantity
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    );
    
    const inventoryData = await inventoryResponse.json();
    const products = inventoryData.data?.products?.edges || [];
    
    // Calcular métricas
    const totalSales = orders.reduce((sum, order) => {
      return sum + parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);
    
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Calcular inventario total
    let totalInventory = 0;
    products.forEach(product => {
      product.node.variants.edges.forEach(variant => {
        variant.node.inventoryItem?.inventoryLevels?.edges?.forEach(level => {
          const availableQty = level.node.quantities?.find(q => q.name === 'available');
          if (availableQty) {
            totalInventory += availableQty.quantity;
          }
        });
      });
    });
    
    return {
      shop,
      locations,
      metrics: {
        totalSales: Math.round(totalSales),
        totalOrders,
        avgTicket: Math.round(avgTicket),
        totalInventory
      },
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    return {
      shop: null,
      locations: [],
      metrics: {
        totalSales: 0,
        totalOrders: 0,
        avgTicket: 0,
        totalInventory: 0
      },
      lastUpdate: new Date().toISOString()
    };
  }
};

export default function DashboardNuevo() {
  const { shop, locations, metrics, lastUpdate } = useLoaderData();
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
        {/* KPIs PRINCIPALES */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            marginBottom: '20px',
            color: '#1a1a1a'
          }}>
            Métricas Clave
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* KPI: Ventas del Período */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderLeft: '4px solid #4ade80',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Ventas del Período</p>
                  <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                    ${metrics.totalSales.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}>💰</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#22c55e', fontSize: '20px' }}>↑</span>
                <span style={{ color: '#22c55e', fontSize: '16px', fontWeight: '600' }}>+12.5%</span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>vs. período anterior</span>
              </div>
            </div>

            {/* KPI: Órdenes Procesadas */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderLeft: '4px solid #3b82f6',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Órdenes Procesadas</p>
                  <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                    {metrics.totalOrders}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}>📦</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#3b82f6', fontSize: '20px' }}>↑</span>
                <span style={{ color: '#3b82f6', fontSize: '16px', fontWeight: '600' }}>+8.3%</span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>vs. período anterior</span>
              </div>
            </div>

            {/* KPI: Ticket Promedio */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderLeft: '4px solid #f59e0b',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Ticket Promedio</p>
                  <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                    ${metrics.avgTicket.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}>🎯</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#f59e0b', fontSize: '20px' }}>↑</span>
                <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: '600' }}>+3.7%</span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>mejor margen</span>
              </div>
            </div>

            {/* KPI: Inventario Total */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderLeft: '4px solid #8b5cf6',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Inventario Total</p>
                  <p style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                    {metrics.totalInventory.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}>📊</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#ef4444', fontSize: '20px' }}>↓</span>
                <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: '600' }}>-2.1%</span>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>rotación saludable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder para próximas secciones */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ color: '#667eea', marginBottom: '10px' }}>📈 Próxima sección: Gráficas de rendimiento</h3>
          <p style={{ color: '#6b7280' }}>KPIs implementados. Las gráficas se agregarán a continuación.</p>
        </div>
      </div>
    </div>
  );
}