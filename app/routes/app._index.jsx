import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  // Obtener el período de la URL
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '30d';
  
  // Calcular días según el período
  const daysMap = {
    '7d': 7,
    '30d': 30,
    '90d': 90
  };
  const days = daysMap[period] || 30;
  
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
    
    // 3. Obtener órdenes recientes para calcular métricas y tendencias
    const ordersResponse = await admin.graphql(
      `#graphql
        query getRecentOrders {
          orders(first: 250, reverse: true) {
            edges {
              node {
                id
                name
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                currentTotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                createdAt
                displayFinancialStatus
                physicalLocation {
                  id
                  name
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      title
                      quantity
                      variant {
                        product {
                          title
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
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders?.edges || [];
    
    // 4. Obtener inventario total y por ubicación
    const inventoryResponse = await admin.graphql(
      `#graphql
        query getInventory {
          products(first: 100) {
            edges {
              node {
                id
                title
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryItem {
                        id
                        unitCost {
                          amount
                        }
                        inventoryLevels(first: 10) {
                          edges {
                            node {
                              location {
                                id
                                name
                              }
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
    
    // Calcular métricas del día de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= today;
    });
    
    const todaySales = todayOrders.reduce((sum, order) => {
      return sum + parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);
    
    const todayOrdersCount = todayOrders.length;
    const todayAvgTicket = todayOrdersCount > 0 ? todaySales / todayOrdersCount : 0;
    
    // Calcular ventas por ubicación para hoy
    const salesByLocation = {};
    todayOrders.forEach(order => {
      const locationName = order.node.physicalLocation?.name || 'Online';
      const amount = parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
      salesByLocation[locationName] = (salesByLocation[locationName] || 0) + amount;
    });
    
    // Encontrar la sucursal con más ventas
    let topLocation = { name: 'Sin ventas', sales: 0 };
    Object.entries(salesByLocation).forEach(([name, sales]) => {
      if (sales > topLocation.sales) {
        topLocation = { name, sales };
      }
    });
    
    // Calcular métricas del período actual según el período seleccionado
    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - days);
    
    const currentPeriodOrders = orders.filter(order => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= periodStartDate;
    });
    
    const totalSales = currentPeriodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.node.totalPriceSet?.shopMoney?.amount || 0);
    }, 0);
    
    const totalOrders = currentPeriodOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Calcular métricas del período anterior (mismo número de días)
    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (days * 2));
    
    const previousPeriodOrders = orders.filter(order => {
      const orderDate = new Date(order.node.createdAt);
      return orderDate >= previousPeriodStart && orderDate < periodStartDate;
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
    
    // Calcular inventario total y por ubicación
    let totalInventory = 0;
    const inventoryByLocation = {};
    let totalInventoryValue = 0;
    
    products.forEach(product => {
      product.node.variants.edges.forEach(variant => {
        const price = parseFloat(variant.node.price || 0);
        variant.node.inventoryItem?.inventoryLevels?.edges?.forEach(level => {
          const availableQty = level.node.quantities?.find(q => q.name === 'available');
          const locationId = level.node.location?.id;
          const locationName = level.node.location?.name || 'Sin ubicación';
          
          if (availableQty && availableQty.quantity > 0) {
            const quantity = availableQty.quantity;
            totalInventory += quantity;
            totalInventoryValue += quantity * price;
            
            if (!inventoryByLocation[locationId]) {
              inventoryByLocation[locationId] = {
                id: locationId,
                name: locationName,
                quantity: 0,
                value: 0
              };
            }
            
            inventoryByLocation[locationId].quantity += quantity;
            inventoryByLocation[locationId].value += quantity * price;
          }
        });
      });
    });
    
    // Para el inventario, asumimos una rotación saludable del 2% mensual
    const inventoryChange = -2.0;
    
    // Procesar datos para la tabla de productos
    const productTableData = {};
    
    products.forEach(product => {
      const productId = product.node.id;
      const productTitle = product.node.title;
      
      if (!productTableData[productId]) {
        productTableData[productId] = {
          id: productId,
          title: productTitle,
          totalQuantity: 0,
          totalInvestment: 0,
          locationData: {}
        };
      }
      
      product.node.variants.edges.forEach(variant => {
        const price = parseFloat(variant.node.price || 0);
        const unitCost = parseFloat(variant.node.inventoryItem?.unitCost?.amount || price * 0.4); // Si no hay costo, usar 40% del precio
        
        variant.node.inventoryItem?.inventoryLevels?.edges?.forEach(level => {
          const availableQty = level.node.quantities?.find(q => q.name === 'available');
          const locationId = level.node.location?.id;
          const locationName = level.node.location?.name || 'Sin ubicación';
          
          if (availableQty && availableQty.quantity > 0) {
            const quantity = availableQty.quantity;
            
            // Actualizar totales del producto
            productTableData[productId].totalQuantity += quantity;
            productTableData[productId].totalInvestment += quantity * unitCost;
            
            // Actualizar datos por ubicación
            if (!productTableData[productId].locationData[locationId]) {
              productTableData[productId].locationData[locationId] = {
                id: locationId,
                name: locationName,
                quantity: 0,
                investment: 0
              };
            }
            
            productTableData[productId].locationData[locationId].quantity += quantity;
            productTableData[productId].locationData[locationId].investment += quantity * unitCost;
          }
        });
      });
    });
    
    // Convertir a array y filtrar productos sin inventario
    const productsList = Object.values(productTableData).filter(p => p.totalQuantity > 0);
    
    // Procesar métricas por sucursal
    const locationMetrics = {};
    
    // Inicializar métricas para cada ubicación
    locations.forEach(location => {
      const locationId = location.node.id;
      locationMetrics[locationId] = {
        id: locationId,
        name: location.node.name,
        sales: 0,
        orders: 0,
        avgTicket: 0,
        unitsSold: 0,
        topProducts: {},
        inventoryValue: inventoryByLocation[locationId]?.value || 0
      };
    });
    
    // Procesar órdenes para calcular métricas por ubicación
    currentPeriodOrders.forEach(order => {
      const locationId = order.node.physicalLocation?.id;
      const locationName = order.node.physicalLocation?.name || 'Online';
      
      if (locationId && locationMetrics[locationId]) {
        const orderAmount = parseFloat(order.node.currentTotalPriceSet?.shopMoney?.amount || 0);
        locationMetrics[locationId].sales += orderAmount;
        locationMetrics[locationId].orders += 1;
        
        // Procesar items de la orden
        order.node.lineItems?.edges?.forEach(item => {
          const quantity = item.node.quantity || 0;
          const productTitle = item.node.title || 'Sin nombre';
          
          locationMetrics[locationId].unitsSold += quantity;
          
          // Track top products
          if (!locationMetrics[locationId].topProducts[productTitle]) {
            locationMetrics[locationId].topProducts[productTitle] = 0;
          }
          locationMetrics[locationId].topProducts[productTitle] += quantity;
        });
      }
    });
    
    // Calcular ticket promedio y encontrar top producto para cada ubicación
    Object.values(locationMetrics).forEach(location => {
      location.avgTicket = location.orders > 0 ? Math.round(location.sales / location.orders) : 0;
      
      // Encontrar el producto más vendido
      let topProduct = { name: 'Sin ventas', quantity: 0 };
      Object.entries(location.topProducts).forEach(([product, quantity]) => {
        if (quantity > topProduct.quantity) {
          topProduct = { name: product, quantity };
        }
      });
      location.topProduct = topProduct;
      
      // Eliminar el objeto topProducts ya que no lo necesitamos en el frontend
      delete location.topProducts;
    });
    
    // Calcular el promedio general para comparación
    const totalLocationSales = Object.values(locationMetrics).reduce((sum, loc) => sum + loc.sales, 0);
    const avgSalesPerLocation = locations.length > 0 ? totalLocationSales / locations.length : 0;
    
    // Agregar porcentaje de rendimiento vs promedio
    Object.values(locationMetrics).forEach(location => {
      location.performanceVsAvg = avgSalesPerLocation > 0 
        ? Math.round(((location.sales - avgSalesPerLocation) / avgSalesPerLocation) * 100)
        : 0;
    });
    
    return {
      shop,
      locations,
      productsList,
      locationMetrics: Object.values(locationMetrics),
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
      todayMetrics: {
        sales: Math.round(todaySales),
        orders: todayOrdersCount,
        avgTicket: Math.round(todayAvgTicket),
        topLocation: topLocation
      },
      inventoryByLocation: Object.values(inventoryByLocation),
      currentPeriod: period,
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
        totalInventory: 0,
        salesChange: 0,
        ordersChange: 0,
        avgTicketChange: 0,
        inventoryChange: 0
      },
      todayMetrics: {
        sales: 0,
        orders: 0,
        avgTicket: 0,
        topLocation: { name: 'Sin datos', sales: 0 }
      },
      inventoryByLocation: [],
      currentPeriod: '30d',
      lastUpdate: new Date().toISOString()
    };
  }
};

export default function DashboardNuevo() {
  const { shop, locations, metrics, todayMetrics, inventoryByLocation, currentPeriod, lastUpdate, productsList, locationMetrics } = useLoaderData();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod || '30d');
  
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
              fontSize: '36px', 
              fontWeight: '700',
              margin: '0 0 10px 0',
              letterSpacing: '-1px',
              textTransform: 'uppercase'
            }}>
              CENTRO DE CONTROL MULTI-TIENDA
            </h1>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: '20px',
              alignItems: 'center',
              marginTop: '10px'
            }}>
              {locations.filter(loc => loc.node.isActive).map((location, index) => (
                <div key={location.node.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                  }} />
                  <span style={{ 
                    color: 'rgba(255,255,255,0.9)', 
                    fontSize: '16px',
                    fontWeight: '400'
                  }}>
                    {location.node.name}
                  </span>
                </div>
              ))}
              <div style={{
                marginLeft: '10px',
                padding: '4px 12px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '20px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: '500'
              }}>
                ({activeLocations} activas)
              </div>
            </div>
          </div>

          {/* Métricas resumen en el header */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr 2fr auto',
            gap: '40px', 
            alignItems: 'center', 
            marginTop: '30px',
            paddingBottom: '10px'
          }}>
            <div style={{
              borderRight: '1px solid rgba(255,255,255,0.2)',
              paddingRight: '40px'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Ventas (30 días)</p>
              <p style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: 0 }}>
                ${metrics.totalSales.toLocaleString()}
              </p>
            </div>
            <div style={{
              borderRight: '1px solid rgba(255,255,255,0.2)',
              paddingRight: '40px'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Órdenes (30 días)</p>
              <p style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: 0 }}>
                {metrics.totalOrders}
              </p>
            </div>
            <div style={{
              borderRight: '1px solid rgba(255,255,255,0.2)',
              paddingRight: '40px'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Ticket Promedio</p>
              <p style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: 0 }}>
                ${metrics.avgTicket}
              </p>
            </div>
            <div style={{
              borderRight: '1px solid rgba(255,255,255,0.2)',
              paddingRight: '40px'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Sucursal Líder (30 días)</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
                <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>
                  {locationMetrics && locationMetrics.length > 0 
                    ? locationMetrics.reduce((top, loc) => loc.sales > top.sales ? loc : top).name
                    : 'Sin datos'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 }}>
                  ${locationMetrics && locationMetrics.length > 0 
                    ? Math.round(locationMetrics.reduce((top, loc) => loc.sales > top.sales ? loc : top).sales).toLocaleString()
                    : '0'} • {locationMetrics && locationMetrics.length > 0 
                    ? locationMetrics.reduce((top, loc) => loc.sales > top.sales ? loc : top).orders
                    : '0'} órdenes
                </p>
              </div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(255,255,255,0.7)', 
              textAlign: 'right',
              minWidth: '100px'
            }}>
              <div style={{ 
                fontSize: '11px', 
                textTransform: 'uppercase',
                marginBottom: '2px'
              }}>
                ACTUALIZADO
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>
                {new Date(lastUpdate).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px' }}>

        {/* TABLA DE PRODUCTOS POR SUCURSAL */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              margin: 0,
              color: '#1a1a1a',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              INVENTARIO DE PRODUCTOS POR SUCURSAL
            </h2>
            <button 
              style={{
                background: '#334155',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#334155'}
              onClick={() => {
                // TODO: Implementar exportación a Excel/CSV
                alert('Función de exportar próximamente disponible');
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 10L12 15L17 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exportar
            </button>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              maxHeight: '500px',
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'relative'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead style={{
                  position: 'sticky',
                  top: 0,
                  background: '#f8f9fa',
                  borderBottom: '2px solid #e5e7eb',
                  zIndex: 10
                }}>
                  <tr>
                    <th style={{
                      padding: '16px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#334155',
                      minWidth: '200px',
                      position: 'sticky',
                      left: 0,
                      background: '#f8f9fa'
                    }}>
                      PRODUCTO
                    </th>
                    <th style={{
                      padding: '16px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#334155',
                      minWidth: '150px'
                    }}>
                      CANT. / INVERSIÓN TOTAL
                    </th>
                    {locations.slice(0, 8).map(location => (
                      <th key={location.node.id} style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#334155',
                        minWidth: '150px',
                        borderLeft: '1px solid #e5e7eb'
                      }}>
                        {location.node.name.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productsList && productsList.map((product, index) => (
                    <tr key={product.id} style={{
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s ease',
                      background: index % 2 === 0 ? 'white' : '#f8f9fa'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#f8f9fa'}>
                      <td style={{
                        padding: '16px',
                        fontWeight: '500',
                        color: '#1a1a1a',
                        position: 'sticky',
                        left: 0,
                        background: 'inherit'
                      }}>
                        {product.title}
                      </td>
                      <td style={{
                        padding: '16px',
                        textAlign: 'right',
                        color: '#334155'
                      }}>
                        <div style={{ fontWeight: '600' }}>
                          {product.totalQuantity.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                          ${Math.round(product.totalInvestment).toLocaleString()}
                        </div>
                      </td>
                      {locations.slice(0, 8).map(location => {
                        const locationData = product.locationData[location.node.id];
                        return (
                          <td key={location.node.id} style={{
                            padding: '16px',
                            textAlign: 'center',
                            color: '#6b7280',
                            borderLeft: '1px solid #f0f0f0'
                          }}>
                            {locationData ? (
                              <div>
                                <div style={{ fontWeight: '600', color: '#334155' }}>
                                  {locationData.quantity}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  ${Math.round(locationData.investment).toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#d1d5db' }}>-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Fila de totales */}
                  <tr style={{
                    position: 'sticky',
                    bottom: 0,
                    borderTop: '2px solid #e5e7eb',
                    background: '#1e293b',
                    fontWeight: '600',
                    color: 'white'
                  }}>
                    <td style={{
                      padding: '16px',
                      color: 'white',
                      position: 'sticky',
                      left: 0,
                      background: '#1e293b'
                    }}>
                      TOTALES
                    </td>
                    <td style={{
                      padding: '16px',
                      textAlign: 'right',
                      color: 'white'
                    }}>
                      <div>
                        {productsList?.reduce((sum, p) => sum + p.totalQuantity, 0).toLocaleString() || '0'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                        ${productsList?.reduce((sum, p) => sum + Math.round(p.totalInvestment), 0).toLocaleString() || '0'}
                      </div>
                    </td>
                    {locations.slice(0, 8).map(location => {
                      const locationTotal = productsList?.reduce((sum, product) => {
                        const locationData = product.locationData[location.node.id];
                        return sum + (locationData ? locationData.quantity : 0);
                      }, 0) || 0;
                      const locationInvestment = productsList?.reduce((sum, product) => {
                        const locationData = product.locationData[location.node.id];
                        return sum + (locationData ? Math.round(locationData.investment) : 0);
                      }, 0) || 0;
                      
                      return (
                        <td key={location.node.id} style={{
                          padding: '16px',
                          textAlign: 'center',
                          color: 'white',
                          borderLeft: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          <div>{locationTotal.toLocaleString()}</div>
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                            ${locationInvestment.toLocaleString()}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MÉTRICAS CLAVE POR SUCURSAL */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              margin: 0,
              color: '#1a1a1a',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              MÉTRICAS CLAVE POR SUCURSAL
            </h2>
            <select 
              style={{
                background: 'white',
                color: '#1e293b',
                border: '1px solid #e5e7eb',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none'
              }}
              value={selectedPeriod}
              onChange={(e) => {
                const url = new URL(window.location);
                url.searchParams.set('period', e.target.value);
                window.location.href = url.toString();
              }}
            >
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="365d">Último año</option>
            </select>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))`,
            gap: '16px'
          }}>
            {locationMetrics && locationMetrics.slice(0, 8).map((location, index) => {
              // Determinar si es la sucursal líder
              const isTopLocation = Math.max(...locationMetrics.map(l => l.sales)) === location.sales && location.sales > 0;
              const performanceColor = location.performanceVsAvg > 10 ? '#16a34a' : 
                                     location.performanceVsAvg < -10 ? '#dc2626' : '#6b7280';
              
              return (
                <div 
                  key={location.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    border: isTopLocation ? '2px solid #334155' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                  }}
                >
                  {/* Badge de líder */}
                  {isTopLocation && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '20px',
                      background: '#334155',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      LÍDER
                    </div>
                  )}
                  
                  {/* Header con nombre e icono */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      margin: 0,
                      color: '#1a1a1a'
                    }}>
                      {location.name}
                    </h3>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: '#f3f4f6',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 20V10L12 3L19 10V20H15V13H9V20H5Z" fill="#475569"/>
                        <path d="M10 20V15H14V20H10Z" fill="#475569"/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* Métricas principales */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>VENTAS</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                        ${Math.round(location.sales).toLocaleString()}
                      </p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>ÓRDENES</p>
                        <p style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#334155' }}>
                          {location.orders}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>TICKET PROM.</p>
                        <p style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#334155' }}>
                          ${location.avgTicket}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>UNIDADES</p>
                        <p style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#334155' }}>
                          {location.unitsSold}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>VS PROMEDIO</p>
                        <p style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: performanceColor }}>
                          {location.performanceVsAvg > 0 ? '+' : ''}{location.performanceVsAvg}%
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Barra de progreso de contribución */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Contribución al total</p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {metrics.totalSales > 0 ? Math.round((location.sales / metrics.totalSales) * 100) : 0}%
                      </p>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: '#f3f4f6',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${metrics.totalSales > 0 ? Math.round((location.sales / metrics.totalSales) * 100) : 0}%`,
                        height: '100%',
                        background: '#334155',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                  
                  {/* Top producto */}
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    padding: '12px',
                    marginTop: '16px'
                  }}>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                      Producto más vendido
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, color: '#1a1a1a' }}>
                      {location.topProduct.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                      {location.topProduct.quantity} unidades
                    </p>
                  </div>
                </div>
              );
            })}
            
            {(!locationMetrics || locationMetrics.length === 0) && (
              <div style={{
                gridColumn: '1 / -1',
                background: '#f7f7f7',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  No hay datos de ventas para el período seleccionado
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}