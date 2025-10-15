import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const locationId = `gid://shopify/Location/${params.id}`;
  
  try {
    // Obtener información completa de la sucursal
    const locationResponse = await admin.graphql(
      `#graphql
        query getLocationDetails($locationId: ID!) {
          location(id: $locationId) {
            id
            name
            address {
              address1
              address2
              city
              province
              country
              zip
              phone
            }
            isActive
            fulfillsOnlineOrders
            inventoryLevels(first: 250) {
              edges {
                node {
                  quantities(names: ["available", "reserved", "on_hand", "committed", "incoming"]) {
                    name
                    quantity
                  }
                  item {
                    id
                    variant {
                      id
                      displayName
                      price
                      sku
                      barcode
                      product {
                        id
                        title
                        handle
                        productType
                        vendor
                        featuredImage {
                          url
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { locationId } }
    );
    
    const locationData = await locationResponse.json();
    const location = locationData.data?.location;
    
    if (!location) {
      throw new Error("Location not found");
    }
    
    // Obtener órdenes de los últimos 30 días para esta ubicación
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ordersResponse = await admin.graphql(
      `#graphql
        query getLocationOrders($query: String!) {
          orders(first: 250, query: $query) {
            edges {
              node {
                id
                name
                createdAt
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
                        product {
                          id
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
      `,
      { 
        variables: { 
          query: `created_at:>='${thirtyDaysAgo.toISOString()}' AND location_id:${params.id}` 
        } 
      }
    );
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders?.edges || [];
    
    // Procesar inventario
    const inventory = location.inventoryLevels.edges || [];
    const inventoryByProduct = {};
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let overStockCount = 0;
    
    inventory.forEach(({ node }) => {
      const quantities = {};
      node.quantities.forEach(q => {
        quantities[q.name] = q.quantity;
      });
      
      const variant = node.item?.variant;
      if (!variant) return;
      
      const product = variant.product;
      const price = parseFloat(variant.price || 0);
      const available = quantities.available || 0;
      
      totalInventoryValue += available * price;
      
      if (available < 10) lowStockCount++;
      if (available > 100) overStockCount++;
      
      if (!inventoryByProduct[product.id]) {
        inventoryByProduct[product.id] = {
          id: product.id,
          title: product.title,
          type: product.productType,
          vendor: product.vendor,
          image: product.featuredImage?.url,
          variants: [],
          totalAvailable: 0,
          totalValue: 0,
          totalSold: 0
        };
      }
      
      inventoryByProduct[product.id].variants.push({
        id: variant.id,
        displayName: variant.displayName,
        sku: variant.sku,
        price,
        available,
        reserved: quantities.reserved || 0,
        onHand: quantities.on_hand || 0,
        incoming: quantities.incoming || 0
      });
      
      inventoryByProduct[product.id].totalAvailable += available;
      inventoryByProduct[product.id].totalValue += available * price;
    });
    
    // Procesar ventas por producto
    const salesByDay = {};
    const salesByProduct = {};
    
    orders.forEach(({ node: order }) => {
      const date = new Date(order.createdAt).toLocaleDateString();
      if (!salesByDay[date]) {
        salesByDay[date] = { date, sales: 0, units: 0 };
      }
      
      salesByDay[date].sales += parseFloat(order.totalPriceSet.shopMoney.amount);
      
      order.lineItems.edges.forEach(({ node: item }) => {
        salesByDay[date].units += item.quantity;
        
        const productId = item.variant?.product?.id;
        if (productId) {
          if (!salesByProduct[productId]) {
            salesByProduct[productId] = 0;
          }
          salesByProduct[productId] += item.quantity;
          
          if (inventoryByProduct[productId]) {
            inventoryByProduct[productId].totalSold = salesByProduct[productId];
          }
        }
      });
    });
    
    // Convertir a arrays y ordenar
    const products = Object.values(inventoryByProduct).sort((a, b) => b.totalSold - a.totalSold);
    const dailySales = Object.values(salesByDay).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calcular métricas generales
    const totalUnits = products.reduce((sum, p) => sum + p.totalAvailable, 0);
    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);
    const totalSalesValue = orders.reduce((sum, { node }) => 
      sum + parseFloat(node.totalPriceSet.shopMoney.amount), 0
    );
    
    // Top productos por diferentes métricas
    const topBySales = [...products].sort((a, b) => b.totalSold - a.totalSold).slice(0, 10);
    const topByValue = [...products].sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
    const topByRotation = [...products]
      .filter(p => p.totalAvailable > 0)
      .map(p => ({ ...p, rotation: p.totalSold / p.totalAvailable }))
      .sort((a, b) => b.rotation - a.rotation)
      .slice(0, 10);
    
    return {
      location,
      inventory: {
        products,
        totalUnits,
        totalValue: totalInventoryValue,
        lowStockCount,
        overStockCount,
        uniqueProducts: products.length
      },
      sales: {
        totalUnits: totalSold,
        totalValue: totalSalesValue,
        orderCount: orders.length,
        avgOrderValue: orders.length > 0 ? totalSalesValue / orders.length : 0,
        dailySales
      },
      analytics: {
        topBySales,
        topByValue,
        topByRotation,
        sellThrough: (totalUnits + totalSold) > 0 ? (totalSold / (totalUnits + totalSold)) * 100 : 0,
        turnoverRate: totalUnits > 0 ? (totalSold / totalUnits) : 0
      },
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Error loading location details:", error);
    throw new Response("Error loading location details", { status: 500 });
  }
};

const COLORS = ['#008060', '#5630ff', '#e3b505', '#ee5737', '#00a0ac', '#ff6900', '#eb4b62'];

export default function LocationDetail() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sales'); // sales, value, stock
  
  // Filtrar productos basado en búsqueda
  const filteredProducts = data.inventory.products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Ordenar productos
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch(sortBy) {
      case 'sales': return b.totalSold - a.totalSold;
      case 'value': return b.totalValue - a.totalValue;
      case 'stock': return b.totalAvailable - a.totalAvailable;
      default: return 0;
    }
  });
  
  // Preparar datos para gráficas
  const inventoryByCategory = {};
  data.inventory.products.forEach(product => {
    const category = product.type || 'Sin categoría';
    if (!inventoryByCategory[category]) {
      inventoryByCategory[category] = { name: category, value: 0 };
    }
    inventoryByCategory[category].value += product.totalAvailable;
  });
  
  const categoryData = Object.values(inventoryByCategory);
  
  // Función para exportar inventario
  const exportInventory = () => {
    const headers = [
      'Producto', 'Tipo', 'Proveedor', 'SKU',
      'Disponible', 'Reservado', 'En Mano', 'Entrante',
      'Precio', 'Valor Total', 'Vendidos (30d)', 'Rotación'
    ];
    
    const rows = [];
    sortedProducts.forEach(product => {
      product.variants.forEach(variant => {
        rows.push([
          product.title,
          product.type || 'N/A',
          product.vendor || 'N/A',
          variant.sku || 'N/A',
          variant.available,
          variant.reserved,
          variant.onHand,
          variant.incoming,
          `$${variant.price}`,
          `$${(variant.available * variant.price).toFixed(2)}`,
          product.totalSold,
          product.totalAvailable > 0 ? `${((product.totalSold / product.totalAvailable) * 100).toFixed(1)}%` : '0%'
        ]);
      });
    });
    
    const csvContent = [
      `Inventario - ${data.location.name} - ${new Date().toLocaleDateString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-${data.location.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  
  const renderGeneralTab = () => (
    <s-stack gap="base">
      {/* Información básica */}
      <s-layout>
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Información de la Sucursal</s-heading>
            <s-stack gap="base">
              <s-text>
                <s-text emphasis="strong">Dirección:</s-text> {data.location.address?.address1}
                {data.location.address?.address2 && `, ${data.location.address.address2}`}
              </s-text>
              <s-text>
                <s-text emphasis="strong">Ciudad:</s-text> {data.location.address?.city}, {data.location.address?.province}
              </s-text>
              <s-text>
                <s-text emphasis="strong">País:</s-text> {data.location.address?.country}
              </s-text>
              {data.location.address?.phone && (
                <s-text>
                  <s-text emphasis="strong">Teléfono:</s-text> {data.location.address.phone}
                </s-text>
              )}
              <s-badge tone={data.location.isActive ? 'success' : 'critical'}>
                {data.location.isActive ? 'Activa' : 'Inactiva'}
              </s-badge>
              {data.location.fulfillsOnlineOrders && (
                <s-badge tone="info">Procesa pedidos online</s-badge>
              )}
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Resumen de Performance</s-heading>
            <s-stack gap="base">
              <s-stack direction="inline" alignment="space-between">
                <s-text>Sell-Through Rate:</s-text>
                <s-badge tone={data.analytics.sellThrough > 50 ? 'success' : 'warning'}>
                  {data.analytics.sellThrough.toFixed(1)}%
                </s-badge>
              </s-stack>
              <s-stack direction="inline" alignment="space-between">
                <s-text>Tasa de Rotación:</s-text>
                <s-text emphasis="strong">{(data.analytics.turnoverRate * 100).toFixed(1)}%</s-text>
              </s-stack>
              <s-stack direction="inline" alignment="space-between">
                <s-text>Productos únicos:</s-text>
                <s-text emphasis="strong">{data.inventory.uniqueProducts}</s-text>
              </s-stack>
              <s-stack direction="inline" alignment="space-between">
                <s-text>Stock bajo (&lt;10):</s-text>
                <s-badge tone="warning">{data.inventory.lowStockCount}</s-badge>
              </s-stack>
              <s-stack direction="inline" alignment="space-between">
                <s-text>Sobrestock (&gt;100):</s-text>
                <s-badge tone="info">{data.inventory.overStockCount}</s-badge>
              </s-stack>
            </s-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
      
      {/* KPIs principales */}
      <s-layout>
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight" alignment="center">
              <s-text subdued>Valor del Inventario</s-text>
              <s-text size="large" emphasis="bold">
                ${data.inventory.totalValue.toLocaleString('es-DO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight" alignment="center">
              <s-text subdued>Unidades Disponibles</s-text>
              <s-text size="large" emphasis="bold">
                {data.inventory.totalUnits.toLocaleString()}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight" alignment="center">
              <s-text subdued>Ventas (30 días)</s-text>
              <s-text size="large" emphasis="bold">
                ${data.sales.totalValue.toLocaleString('es-DO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight" alignment="center">
              <s-text subdued>Unidades Vendidas</s-text>
              <s-text size="large" emphasis="bold">
                {data.sales.totalUnits.toLocaleString()}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
      
      {/* Gráficas de resumen */}
      <s-layout>
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Ventas Diarias (30 días)</s-heading>
            <div style={{ width: '100%', height: 300, marginTop: 20 }}>
              <ResponsiveContainer>
                <AreaChart data={data.sales.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="sales" stroke="#5630ff" fill="#5630ff" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Inventario por Categoría</s-heading>
            <div style={{ width: '100%', height: 300, marginTop: 20 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-stack>
  );
  
  const renderInventoryTab = () => (
    <s-stack gap="base">
      {/* Controles de búsqueda y ordenamiento */}
      <s-card>
        <s-layout>
          <s-layout-section variant="one-half">
            <s-text-field
              label="Buscar producto"
              placeholder="Nombre, tipo o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              clearButton
              onClearButtonClick={() => setSearchTerm('')}
            />
          </s-layout-section>
          <s-layout-section variant="one-half">
            <s-stack direction="inline" alignment="end" gap="tight">
              <s-select
                label="Ordenar por"
                options={[
                  { label: 'Más vendidos', value: 'sales' },
                  { label: 'Mayor valor', value: 'value' },
                  { label: 'Mayor stock', value: 'stock' }
                ]}
                value={sortBy}
                onChange={(value) => setSortBy(value)}
              />
              <s-button onClick={exportInventory}>
                Exportar CSV
              </s-button>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-card>
      
      {/* Lista de productos */}
      <s-card>
        <s-table>
          <s-table-head>
            <s-table-row>
              <s-table-header>Producto</s-table-header>
              <s-table-header>Tipo</s-table-header>
              <s-table-header>Stock</s-table-header>
              <s-table-header>Reservado</s-table-header>
              <s-table-header>Valor</s-table-header>
              <s-table-header>Vendidos</s-table-header>
              <s-table-header>Rotación</s-table-header>
              <s-table-header>Estado</s-table-header>
            </s-table-row>
          </s-table-head>
          <s-table-body>
            {sortedProducts.slice(0, 50).map((product) => (
              <s-table-row key={product.id}>
                <s-table-cell>
                  <s-stack direction="inline" gap="tight" alignment="center">
                    {product.image && (
                      <img 
                        src={product.image} 
                        alt={product.title} 
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <s-stack gap="extra-tight">
                      <s-text emphasis="strong">{product.title}</s-text>
                      <s-text size="small" subdued>{product.vendor}</s-text>
                    </s-stack>
                  </s-stack>
                </s-table-cell>
                <s-table-cell>{product.type || 'Sin tipo'}</s-table-cell>
                <s-table-cell>
                  <s-badge tone={product.totalAvailable < 10 ? 'critical' : 'default'}>
                    {product.totalAvailable}
                  </s-badge>
                </s-table-cell>
                <s-table-cell>
                  {product.variants.reduce((sum, v) => sum + v.reserved, 0)}
                </s-table-cell>
                <s-table-cell>
                  ${product.totalValue.toLocaleString('es-DO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </s-table-cell>
                <s-table-cell>
                  <s-text emphasis={product.totalSold > 0 ? "strong" : undefined}>
                    {product.totalSold}
                  </s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-badge 
                    tone={
                      product.totalAvailable > 0 && product.totalSold / product.totalAvailable > 0.5 
                        ? 'success' 
                        : product.totalAvailable > 0 && product.totalSold / product.totalAvailable > 0.25
                        ? 'warning'
                        : 'critical'
                    }
                  >
                    {product.totalAvailable > 0 
                      ? `${((product.totalSold / product.totalAvailable) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </s-badge>
                </s-table-cell>
                <s-table-cell>
                  {product.totalAvailable < 10 && (
                    <s-badge tone="critical">Stock bajo</s-badge>
                  )}
                  {product.totalAvailable > 100 && product.totalSold < 10 && (
                    <s-badge tone="warning">Sobrestock</s-badge>
                  )}
                  {product.totalAvailable >= 10 && product.totalAvailable <= 100 && (
                    <s-badge tone="success">Óptimo</s-badge>
                  )}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {sortedProducts.length > 50 && (
          <s-text size="small" subdued style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
            Mostrando 50 de {sortedProducts.length} productos
          </s-text>
        )}
      </s-card>
    </s-stack>
  );
  
  const renderSalesTab = () => (
    <s-stack gap="base">
      {/* Resumen de ventas */}
      <s-layout>
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight">
              <s-text subdued>Total Ventas (30d)</s-text>
              <s-text size="large" emphasis="bold">
                ${data.sales.totalValue.toLocaleString('es-DO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight">
              <s-text subdued>Órdenes</s-text>
              <s-text size="large" emphasis="bold">{data.sales.orderCount}</s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight">
              <s-text subdued>Ticket Promedio</s-text>
              <s-text size="large" emphasis="bold">
                ${data.sales.avgOrderValue.toLocaleString('es-DO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-quarter">
          <s-card>
            <s-stack gap="tight">
              <s-text subdued>Unidades Vendidas</s-text>
              <s-text size="large" emphasis="bold">
                {data.sales.totalUnits.toLocaleString()}
              </s-text>
            </s-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
      
      {/* Top productos por ventas */}
      <s-layout>
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Top 10 - Más Vendidos</s-heading>
            <s-stack gap="tight" style={{ marginTop: '1rem' }}>
              {data.analytics.topBySales.map((product, index) => (
                <s-stack 
                  key={product.id} 
                  direction="inline" 
                  alignment="space-between"
                  style={{ 
                    padding: '0.5rem',
                    background: index % 2 === 0 ? '#f5f5f5' : 'transparent',
                    borderRadius: '4px'
                  }}
                >
                  <s-stack direction="inline" gap="tight" alignment="center">
                    <s-text emphasis="strong">{index + 1}.</s-text>
                    <s-text>{product.title}</s-text>
                  </s-stack>
                  <s-badge tone="success">{product.totalSold} vendidos</s-badge>
                </s-stack>
              ))}
            </s-stack>
          </s-card>
        </s-layout-section>
        
        <s-layout-section variant="one-half">
          <s-card>
            <s-heading size="small">Top 10 - Mayor Rotación</s-heading>
            <s-stack gap="tight" style={{ marginTop: '1rem' }}>
              {data.analytics.topByRotation.map((product, index) => (
                <s-stack 
                  key={product.id} 
                  direction="inline" 
                  alignment="space-between"
                  style={{ 
                    padding: '0.5rem',
                    background: index % 2 === 0 ? '#f5f5f5' : 'transparent',
                    borderRadius: '4px'
                  }}
                >
                  <s-stack direction="inline" gap="tight" alignment="center">
                    <s-text emphasis="strong">{index + 1}.</s-text>
                    <s-text>{product.title}</s-text>
                  </s-stack>
                  <s-badge tone="info">
                    {(product.rotation * 100).toFixed(1)}% rotación
                  </s-badge>
                </s-stack>
              ))}
            </s-stack>
          </s-card>
        </s-layout-section>
      </s-layout>
      
      {/* Tendencia de ventas */}
      <s-card>
        <s-heading size="small">Tendencia de Ventas (30 días)</s-heading>
        <div style={{ width: '100%', height: 400, marginTop: 20 }}>
          <ResponsiveContainer>
            <LineChart data={data.sales.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" orientation="left" stroke="#5630ff" />
              <YAxis yAxisId="right" orientation="right" stroke="#008060" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#5630ff" name="Ventas ($)" />
              <Line yAxisId="right" type="monotone" dataKey="units" stroke="#008060" name="Unidades" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </s-card>
    </s-stack>
  );
  
  return (
    <s-page 
      heading={data.location.name}
      backAction={{
        content: 'Sucursales',
        onAction: () => navigate('/app/sucursales')
      }}
    >
      {/* Tabs de navegación */}
      <s-tabs 
        selected={activeTab} 
        onChange={setActiveTab}
        tabs={[
          { id: 'general', content: 'General' },
          { id: 'inventory', content: 'Inventario' },
          { id: 'sales', content: 'Ventas' }
        ]}
      />
      
      {/* Contenido según tab activo */}
      <s-section>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'sales' && renderSalesTab()}
      </s-section>
      
      {/* Sidebar con acciones */}
      <s-section slot="aside" heading="Acciones">
        <s-stack gap="base">
          <s-button fullWidth onClick={() => navigate(`/app/sucursal/${data.location.id.split('/').pop()}/edit`)}>
            Editar Sucursal
          </s-button>
          <s-button fullWidth variant="secondary" onClick={() => navigate(`/app/sucursal/${data.location.id.split('/').pop()}/transfer`)}>
            Transferir Inventario
          </s-button>
          <s-button fullWidth variant="secondary" onClick={() => window.print()}>
            Imprimir Reporte
          </s-button>
          <s-divider />
          <s-text size="small" subdued>
            Última actualización: {new Date(data.lastUpdate).toLocaleString('es-DO')}
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}