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
                      sku
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
          sku: null,
          totalQuantity: 0,
          totalInvestment: 0,
          locationData: {}
        };
      }
      
      product.node.variants.edges.forEach(variant => {
        const price = parseFloat(variant.node.price || 0);
        const unitCost = parseFloat(variant.node.inventoryItem?.unitCost?.amount || price * 0.4); // Si no hay costo, usar 40% del precio
        const sku = variant.node.sku || '';
        
        // Guardar el SKU del primer variante con inventario
        if (!productTableData[productId].sku && sku) {
          productTableData[productId].sku = sku;
        }
        
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
    
    // Calcular top productos globales
    const globalTopProducts = {};
    // const employeeMetrics = {}; // DESHABILITADO - staffMember no disponible
    
    // Procesar órdenes para calcular métricas por ubicación, productos globales y empleados
    currentPeriodOrders.forEach(order => {
      const locationId = order.node.physicalLocation?.id;
      const locationName = order.node.physicalLocation?.name || 'Online';
      const orderAmount = parseFloat(order.node.currentTotalPriceSet?.shopMoney?.amount || 0);
      
      // Procesar métricas de empleado - DESHABILITADO TEMPORALMENTE
      // El campo staffMember requiere permisos especiales o puede no estar disponible
      
      if (locationId && locationMetrics[locationId]) {
        locationMetrics[locationId].sales += orderAmount;
        locationMetrics[locationId].orders += 1;
        
        // Procesar items de la orden
        order.node.lineItems?.edges?.forEach(item => {
          const quantity = item.node.quantity || 0;
          const productTitle = item.node.title || 'Sin nombre';
          const productTitleClean = item.node.variant?.product?.title || productTitle;
          
          // Contar productos para el empleado - DESHABILITADO
          
          // Métricas por ubicación
          locationMetrics[locationId].unitsSold += quantity;
          
          // Track top products por ubicación
          if (!locationMetrics[locationId].topProducts[productTitle]) {
            locationMetrics[locationId].topProducts[productTitle] = 0;
          }
          locationMetrics[locationId].topProducts[productTitle] += quantity;
          
          // Track top products globales
          if (!globalTopProducts[productTitleClean]) {
            globalTopProducts[productTitleClean] = {
              title: productTitleClean,
              quantity: 0,
              revenue: 0,
              orders: 0,
              locations: new Set()
            };
          }
          globalTopProducts[productTitleClean].quantity += quantity;
          globalTopProducts[productTitleClean].orders += 1;
          globalTopProducts[productTitleClean].locations.add(locationName);
          
          // Calcular revenue aproximado (dividiendo el total de la orden entre items)
          const itemsInOrder = order.node.lineItems.edges.length;
          const estimatedItemRevenue = orderAmount / itemsInOrder;
          globalTopProducts[productTitleClean].revenue += estimatedItemRevenue;
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
    
    // Convertir top productos globales a array y ordenar por cantidad
    const topProductsArray = Object.values(globalTopProducts).map(product => ({
      ...product,
      locations: Array.from(product.locations),
      avgPrice: product.revenue / product.quantity,
      locationsCount: product.locations.size
    }));
    
    // Ordenar por cantidad vendida y tomar los top 9
    const top9Products = topProductsArray
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 9)
      .map((product, index) => ({
        ...product,
        rank: index + 1,
        revenue: Math.round(product.revenue),
        avgPrice: Math.round(product.avgPrice)
      }));
    
    // Procesar y ordenar empleados por ventas totales - DESHABILITADO
    const topEmployees = []; // Array vacío hasta que tengamos acceso a staffMember
    
    return {
      shop,
      locations,
      productsList,
      locationMetrics: Object.values(locationMetrics),
      top9Products,
      topEmployees,
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
      productsList: [],
      locationMetrics: [],
      top9Products: [],
      topEmployees: [],
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
      currentPeriod: period || '30d',
      lastUpdate: new Date().toISOString()
    };
  }
};

export default function DashboardNuevo() {
  const { shop, locations, metrics, todayMetrics, inventoryByLocation, currentPeriod, lastUpdate, productsList, locationMetrics, top9Products, topEmployees } = useLoaderData();
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
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <div style={{
              maxHeight: '600px',
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'relative'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    background: '#fafafa'
                  }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      background: '#fafafa',
                      zIndex: 20,
                      minWidth: '200px'
                    }}>
                      Producto
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '150px'
                    }}>
                      Cant. / Inversión
                    </th>
                    {locations.slice(0, 8).map(location => (
                      <th key={location.node.id} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '500',
                        color: '#6b7280',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #e5e7eb',
                        borderLeft: '1px solid #e5e7eb',
                        position: 'sticky',
                        top: 0,
                        background: '#fafafa',
                        minWidth: '150px'
                      }}>
                        {location.node.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productsList && productsList.map((product, index) => (
                    <tr key={product.id} style={{
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'all 0.15s ease',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fafafa';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                      <td style={{
                        padding: '14px 16px',
                        position: 'sticky',
                        left: 0,
                        background: 'inherit',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div>
                          {product.sku && (
                            <div style={{ 
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827',
                              marginBottom: '2px'
                            }}>
                              {product.sku.substring(0, 4).toUpperCase()}
                            </div>
                          )}
                          <div style={{ 
                            fontSize: '12px',
                            fontWeight: '400',
                            color: '#6b7280',
                            lineHeight: '1.4'
                          }}>
                            {product.title}
                          </div>
                        </div>
                      </td>
                      <td style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#111827',
                          marginBottom: '2px'
                        }}>
                          {product.totalQuantity.toLocaleString()}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: '400'
                        }}>
                          ${Math.round(product.totalInvestment).toLocaleString()}
                        </div>
                      </td>
                      {locations.slice(0, 8).map(location => {
                        const locationData = product.locationData[location.node.id];
                        return (
                          <td key={location.node.id} style={{
                            padding: '14px 16px',
                            textAlign: 'center',
                            borderLeft: '1px solid #e5e7eb',
                            borderBottom: '1px solid #e5e7eb'
                          }}>
                            {locationData ? (
                              <div>
                                <div style={{ 
                                  fontWeight: '600', 
                                  fontSize: '14px',
                                  color: '#111827',
                                  marginBottom: '2px'
                                }}>
                                  {locationData.quantity}
                                </div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#6b7280',
                                  fontWeight: '400'
                                }}>
                                  ${Math.round(locationData.investment).toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span style={{ 
                                color: '#d1d5db',
                                fontSize: '14px'
                              }}>—</span>
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
                    background: '#f9fafb',
                    fontWeight: '600'
                  }}>
                    <td style={{
                      padding: '14px 16px',
                      color: '#6b7280',
                      position: 'sticky',
                      left: 0,
                      background: '#f9fafb',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500'
                    }}>
                      Totales
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      background: '#f9fafb'
                    }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '2px'
                      }}>
                        {productsList?.reduce((sum, p) => sum + p.totalQuantity, 0).toLocaleString() || '0'}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280', 
                        fontWeight: '500' 
                      }}>
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
                          padding: '14px 16px',
                          textAlign: 'center',
                          borderLeft: '1px solid #e5e7eb',
                          background: '#f9fafb'
                        }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '600',
                            color: '#111827',
                            marginBottom: '2px'
                          }}>
                            {locationTotal.toLocaleString()}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#6b7280', 
                            fontWeight: '500'
                          }}>
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

        {/* DIVISOR MODERNO */}
        <div style={{ 
          margin: '50px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, #e5e7eb 20%, #e5e7eb 80%, transparent 100%)',
            width: '100%',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#f8f9fa',
              padding: '0 20px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#cbd5e1',
                boxShadow: '0 0 0 4px #f8f9fa'
              }} />
            </div>
          </div>
        </div>

        {/* TOP 9 PRODUCTOS MÁS VENDIDOS */}
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
              TOP 9 PRODUCTOS MÁS VENDIDOS
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              fontWeight: '500' 
            }}>
              Período: {selectedPeriod === '7d' ? 'Últimos 7 días' : 
                        selectedPeriod === '30d' ? 'Últimos 30 días' : 
                        selectedPeriod === '90d' ? 'Últimos 90 días' : 
                        'Último año'}
            </div>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px'
          }}>
            {top9Products && top9Products.map((product) => {
              const isTop3 = product.rank <= 3;
              const performancePercent = top9Products[0]?.quantity > 0 
                ? Math.round((product.quantity / top9Products[0].quantity) * 100) 
                : 0;
              
              return (
                <div 
                  key={product.title}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: isTop3 ? '2px solid #e5e7eb' : '1px solid #e5e7eb',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    if (!isTop3) e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  {/* Ranking Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '20px',
                    background: isTop3 ? '#111827' : '#f3f4f6',
                    color: isTop3 ? 'white' : '#6b7280',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: '3px solid white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {product.rank}
                  </div>
                  
                  {/* Producto Info */}
                  <div style={{ marginBottom: '16px', paddingTop: '8px' }}>
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      margin: '0 0 8px 0',
                      color: '#1a1a1a',
                      lineHeight: '1.3'
                    }}>
                      {product.title}
                    </h3>
                    
                    {/* Métricas principales */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'baseline', 
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <p style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#1a1a1a' }}>
                          {product.quantity.toLocaleString()}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>unidades vendidas</p>
                      </div>
                      <div style={{ 
                        padding: '4px 10px',
                        background: '#fafafa',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb'
                      }}>
                        ${product.revenue.toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Métricas secundarias */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                          Precio Promedio
                        </p>
                        <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#334155' }}>
                          ${product.avgPrice}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                          Órdenes
                        </p>
                        <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#334155' }}>
                          {product.orders}
                        </p>
                      </div>
                    </div>
                    
                    {/* Barra de rendimiento */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, textTransform: 'uppercase' }}>
                          Rendimiento vs #1
                        </p>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                          {performancePercent}%
                        </p>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${performancePercent}%`,
                          height: '100%',
                          background: isTop3 ? '#111827' : '#d1d5db',
                          transition: 'width 0.3s ease',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                    
                    {/* Ubicaciones */}
                    <div style={{
                      background: '#fafafa',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#6b7280',
                      border: '1px solid #f3f4f6'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '500', color: '#374151' }}>
                        Disponible en {product.locationsCount} sucursales
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.4', color: '#9ca3af' }}>
                        {product.locations.slice(0, 3).join(', ')}
                        {product.locations.length > 3 && ` y ${product.locations.length - 3} más`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {(!top9Products || top9Products.length === 0) && (
              <div style={{
                gridColumn: '1 / -1',
                background: '#f7f7f7',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  No hay datos de productos vendidos para el período seleccionado
                </p>
              </div>
            )}
          </div>
        </div>

        {/* DIVISOR MODERNO */}
        <div style={{ 
          margin: '50px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, #e5e7eb 20%, #e5e7eb 80%, transparent 100%)',
            width: '100%',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#f8f9fa',
              padding: '0 20px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#cbd5e1',
                boxShadow: '0 0 0 4px #f8f9fa'
              }} />
            </div>
          </div>
        </div>

        {/* VENTAS POR EMPLEADO */}
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
              RANKING DE VENTAS POR EMPLEADO
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              fontWeight: '500' 
            }}>
              Comisión del 1% sobre ventas
            </div>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <div style={{
              overflowX: 'auto',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    background: '#fafafa'
                  }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '50px',
                      zIndex: 10
                    }}>
                      #
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '200px'
                    }}>
                      Empleado
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '120px'
                    }}>
                      Productos
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '100px'
                    }}>
                      Órdenes
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '120px'
                    }}>
                      Ventas
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '100px'
                    }}>
                      Ticket
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '120px'
                    }}>
                      Comisión
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '500',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      position: 'sticky',
                      top: 0,
                      background: '#fafafa',
                      minWidth: '120px'
                    }}>
                      Sucursales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topEmployees && topEmployees.map((employee, index) => {
                    const isTop3 = employee.rank <= 3;
                    
                    return (
                      <tr key={employee.id} style={{
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'all 0.15s ease',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isTop3 ? '#111827' : '#f3f4f6',
                            color: isTop3 ? 'white' : '#6b7280',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: '600',
                            margin: '0 auto'
                          }}>
                            {employee.rank}
                          </div>
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb'
                        }}>
                          <div>
                            <div style={{ 
                              fontWeight: '600', 
                              fontSize: '14px',
                              color: '#111827',
                              marginBottom: '2px'
                            }}>
                              {employee.name}
                            </div>
                            {employee.email && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#6b7280',
                                fontWeight: '400'
                              }}>
                                {employee.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#111827'
                        }}>
                          {employee.productsCount.toLocaleString()}
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#111827'
                        }}>
                          {employee.orders.toLocaleString()}
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          ${employee.totalSales.toLocaleString()}
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#6b7280'
                        }}>
                          ${employee.avgOrderValue}
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'right',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb'
                        }}>
                          <span style={{
                            color: '#059669',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: '#d1fae5',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            ${employee.commission.toLocaleString()}
                          </span>
                        </td>
                        <td style={{
                          padding: '14px 16px',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            background: '#f3f4f6',
                            borderRadius: '6px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'inline-block'
                          }}>
                            {employee.locationsCount} {employee.locationsCount !== 1 ? 'sucursales' : 'sucursal'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Fila de totales */}
                  <tr style={{
                    borderTop: '2px solid #e5e7eb',
                    background: '#f9fafb',
                    position: 'sticky',
                    bottom: 0
                  }}>
                    <td colSpan={2} style={{
                      padding: '14px 16px',
                      color: '#6b7280',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: '500',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      Totales
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      {topEmployees?.reduce((sum, e) => sum + e.productsCount, 0).toLocaleString() || '0'}
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      {topEmployees?.reduce((sum, e) => sum + e.orders, 0).toLocaleString() || '0'}
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#111827',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      ${topEmployees?.reduce((sum, e) => sum + e.totalSales, 0).toLocaleString() || '0'}
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'center',
                      color: '#6b7280',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      —
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      textAlign: 'right',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                      <span style={{
                        color: '#059669',
                        fontSize: '14px',
                        fontWeight: '700',
                        background: '#d1fae5',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        display: 'inline-block'
                      }}>
                        ${topEmployees?.reduce((sum, e) => sum + e.commission, 0).toFixed(2) || '0'}
                      </span>
                    </td>
                    <td style={{
                      padding: '14px 16px',
                      borderLeft: '1px solid #e5e7eb'
                    }}>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {(!topEmployees || topEmployees.length === 0) && (
            <div style={{
              background: '#f7f7f7',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              marginTop: '16px'
            }}>
              <p style={{ color: '#6b7280', margin: 0 }}>
                No hay datos de ventas por empleado para el período seleccionado
              </p>
            </div>
          )}
        </div>

        {/* DIVISOR MODERNO */}
        <div style={{ 
          margin: '50px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, #e5e7eb 20%, #e5e7eb 80%, transparent 100%)',
            width: '100%',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#f8f9fa',
              padding: '0 20px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#cbd5e1',
                boxShadow: '0 0 0 4px #f8f9fa'
              }} />
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
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: isTopLocation ? '2px solid #e5e7eb' : '1px solid #e5e7eb',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    if (!isTopLocation) e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  {/* Badge de líder */}
                  {isTopLocation && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '20px',
                      background: '#111827',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '14px',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                      width: '36px',
                      height: '36px',
                      background: '#fafafa',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '1px solid #f3f4f6'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 20V10L12 3L19 10V20H15V13H9V20H5Z" fill="#6b7280"/>
                        <path d="M10 20V15H14V20H10Z" fill="#6b7280"/>
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
                      height: '4px',
                      background: '#f3f4f6',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${metrics.totalSales > 0 ? Math.round((location.sales / metrics.totalSales) * 100) : 0}%`,
                        height: '100%',
                        background: '#111827',
                        transition: 'width 0.3s ease',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                  
                  {/* Top producto */}
                  <div style={{
                    background: '#fafafa',
                    borderRadius: '10px',
                    padding: '12px',
                    marginTop: '16px',
                    border: '1px solid #f3f4f6'
                  }}>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Producto más vendido
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, color: '#111827' }}>
                      {location.topProduct.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
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