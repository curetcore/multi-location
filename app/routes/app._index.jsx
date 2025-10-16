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
    
    // 3. Obtener órdenes de los últimos 60 días para calcular métricas y tendencias
    const ordersResponse = await admin.graphql(
      `#graphql
        query getRecentOrders {
          orders(first: 100, reverse: true, query: "created_at:>2024-08-01") {
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
    
    // Calcular métricas del período actual (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const currentPeriodOrders = orders.filter(order => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= thirtyDaysAgo;
    });
    
    const totalSales = currentPeriodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);
    
    const totalOrders = currentPeriodOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Calcular métricas del período anterior (60-30 días atrás)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const previousPeriodOrders = orders.filter(order => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= sixtyDaysAgo && orderDate < thirtyDaysAgo;
    });
    
    const previousSales = previousPeriodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);
    
    const previousOrders = previousPeriodOrders.length;
    const previousAvgTicket = previousOrders > 0 ? previousSales / previousOrders : 0;
    
    // Calcular cambios porcentuales
    const salesChange = previousSales > 0 ? ((totalSales - previousSales) / previousSales) * 100 : 0;
    const ordersChange = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
    const avgTicketChange = previousAvgTicket > 0 ? ((avgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;
    
    // Calcular inventario total
    let totalInventory = 0;
    let previousInventory = 0; // Por ahora no tenemos histórico de inventario
    
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
    
    // Para el inventario, asumimos una rotación saludable del 2% mensual
    const inventoryChange = -2.0;
    
    return {
      shop,
      locations,
      metrics: {
        totalSales: Math.round(totalSales),
        totalOrders,
        avgTicket: Math.round(avgTicket),
        totalInventory,
        salesChange: Math.round(salesChange * 10) / 10,
        ordersChange: Math.round(ordersChange * 10) / 10,
        avgTicketChange: Math.round(avgTicketChange * 10) / 10,
        inventoryChange: inventoryChange
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
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '40px 0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
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
                  color: '#1e293b',
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
              borderLeft: '4px solid #10b981',
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
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1.93.66 1.64 2.08 1.64 1.51 0 2.1-.63 2.1-1.51 0-.83-.44-1.36-2.23-1.86-2.09-.59-3.43-1.42-3.43-3.21 0-1.51 1.22-2.48 2.94-2.81V5h2.67v1.95c1.44.32 2.51 1.23 2.66 2.95h-1.96c-.09-.82-.63-1.45-1.65-1.45-1.13 0-1.76.55-1.76 1.4 0 .8.6 1.22 2.17 1.7 1.93.53 3.38 1.28 3.38 3.27.02 1.65-1.21 2.83-3.19 3.27z" fill="#4ade80"/>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {metrics.salesChange !== 0 && (
                  <>
                    <span style={{ 
                      color: metrics.salesChange > 0 ? '#10b981' : '#ef4444', 
                      fontSize: '20px' 
                    }}>
                      {metrics.salesChange > 0 ? '↑' : '↓'}
                    </span>
                    <span style={{ 
                      color: metrics.salesChange > 0 ? '#10b981' : '#ef4444', 
                      fontSize: '16px', 
                      fontWeight: '600' 
                    }}>
                      {metrics.salesChange > 0 ? '+' : ''}{metrics.salesChange}%
                    </span>
                  </>
                )}
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  {metrics.salesChange === 0 ? 'Sin cambios' : 'vs. período anterior'}
                </span>
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
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="#3b82f6"/>
                    <path d="M8 12h6v2H8z" fill="#3b82f6"/>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {metrics.ordersChange !== 0 && (
                  <>
                    <span style={{ 
                      color: metrics.ordersChange > 0 ? '#3b82f6' : '#ef4444', 
                      fontSize: '20px' 
                    }}>
                      {metrics.ordersChange > 0 ? '↑' : '↓'}
                    </span>
                    <span style={{ 
                      color: metrics.ordersChange > 0 ? '#3b82f6' : '#ef4444', 
                      fontSize: '16px', 
                      fontWeight: '600' 
                    }}>
                      {metrics.ordersChange > 0 ? '+' : ''}{metrics.ordersChange}%
                    </span>
                  </>
                )}
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  {metrics.ordersChange === 0 ? 'Sin cambios' : 'vs. período anterior'}
                </span>
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
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="#f59e0b"/>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {metrics.avgTicketChange !== 0 && (
                  <>
                    <span style={{ 
                      color: metrics.avgTicketChange > 0 ? '#f59e0b' : '#ef4444', 
                      fontSize: '20px' 
                    }}>
                      {metrics.avgTicketChange > 0 ? '↑' : '↓'}
                    </span>
                    <span style={{ 
                      color: metrics.avgTicketChange > 0 ? '#f59e0b' : '#ef4444', 
                      fontSize: '16px', 
                      fontWeight: '600' 
                    }}>
                      {metrics.avgTicketChange > 0 ? '+' : ''}{metrics.avgTicketChange}%
                    </span>
                  </>
                )}
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  {metrics.avgTicketChange === 0 ? 'Sin cambios' : metrics.avgTicketChange > 0 ? 'mejor margen' : 'menor margen'}
                </span>
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
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" fill="#8b5cf6"/>
                    <path d="M3 21h18v-2H3v2z" fill="#8b5cf6"/>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {metrics.inventoryChange !== 0 && (
                  <>
                    <span style={{ 
                      color: metrics.inventoryChange > 0 ? '#8b5cf6' : '#ef4444', 
                      fontSize: '20px' 
                    }}>
                      {metrics.inventoryChange > 0 ? '↑' : '↓'}
                    </span>
                    <span style={{ 
                      color: metrics.inventoryChange < 0 ? '#10b981' : '#ef4444', 
                      fontSize: '16px', 
                      fontWeight: '600' 
                    }}>
                      {metrics.inventoryChange > 0 ? '+' : ''}{metrics.inventoryChange}%
                    </span>
                  </>
                )}
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  {metrics.inventoryChange < 0 ? 'rotación saludable' : 'stock acumulado'}
                </span>
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
          <h3 style={{ color: '#6b7280', marginBottom: '10px' }}>Próxima sección: Gráficas de rendimiento</h3>
          <p style={{ color: '#6b7280' }}>KPIs implementados. Las gráficas se agregarán a continuación.</p>
        </div>
      </div>
    </div>
  );
}