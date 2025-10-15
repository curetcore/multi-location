import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { 
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const locationId = `gid://shopify/Location/${params.id}`;
  
  try {
    // Obtener detalles de la ubicación
    const locationResponse = await admin.graphql(
      `#graphql
        query getLocationDetails($id: ID!) {
          location(id: $id) {
            id
            name
            address {
              address1
              address2
              city
              province
              country
              zip
            }
            isActive
            inventoryLevels(first: 250) {
              edges {
                node {
                  id
                  quantities(names: ["available", "on_hand", "reserved"]) {
                    name
                    quantity
                  }
                  item {
                    id
                    sku
                    variant {
                      id
                      title
                      price
                      sku
                      barcode
                      product {
                        id
                        title
                        featuredImage {
                          url
                          altText
                        }
                        priceRangeV2 {
                          minVariantPrice {
                            amount
                          }
                          maxVariantPrice {
                            amount
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
      `,
      { variables: { id: locationId } }
    );
    
    const data = await locationResponse.json();
    const location = data.data?.location;
    
    if (!location) {
      throw new Error("Location not found");
    }
    
    // Procesar datos de inventario
    const inventoryItems = location.inventoryLevels.edges.map(({ node }) => {
      const quantities = {};
      node.quantities.forEach(q => {
        quantities[q.name] = q.quantity;
      });
      
      return {
        id: node.id,
        sku: node.item?.sku || node.item?.variant?.sku || 'N/A',
        productTitle: node.item?.variant?.product?.title || 'Sin título',
        variantTitle: node.item?.variant?.title || 'Default',
        price: parseFloat(node.item?.variant?.price || 0),
        barcode: node.item?.variant?.barcode || 'N/A',
        available: quantities.available || 0,
        onHand: quantities.on_hand || 0,
        reserved: quantities.reserved || 0,
        imageUrl: node.item?.variant?.product?.featuredImage?.url,
        productId: node.item?.variant?.product?.id,
      };
    });
    
    // Calcular estadísticas
    const stats = {
      totalProducts: inventoryItems.length,
      totalItems: inventoryItems.reduce((sum, item) => sum + item.available, 0),
      totalValue: inventoryItems.reduce((sum, item) => sum + (item.available * item.price), 0),
      totalReserved: inventoryItems.reduce((sum, item) => sum + item.reserved, 0),
    };
    
    // Top 10 productos por valor
    const topProducts = [...inventoryItems]
      .sort((a, b) => (b.available * b.price) - (a.available * a.price))
      .slice(0, 10)
      .map(item => ({
        name: item.productTitle.substring(0, 20) + '...',
        value: item.available * item.price,
        quantity: item.available
      }));
    
    return {
      location,
      inventoryItems,
      stats,
      topProducts
    };
    
  } catch (error) {
    console.error("Error loading location details:", error);
    return {
      location: null,
      inventoryItems: [],
      stats: { totalProducts: 0, totalItems: 0, totalValue: 0, totalReserved: 0 },
      topProducts: []
    };
  }
};

export default function LocationDetail() {
  const { location, inventoryItems, stats, topProducts } = useLoaderData();
  const navigate = useNavigate();
  
  if (!location) {
    return (
      <s-page heading="Ubicación no encontrada">
        <s-section>
          <s-banner tone="critical">
            La ubicación solicitada no existe o no se pudo cargar.
          </s-banner>
          <s-button onClick={() => navigate('/app')}>
            Volver al dashboard
          </s-button>
        </s-section>
      </s-page>
    );
  }
  
  // Función para exportar inventario de esta ubicación
  const exportLocationCSV = () => {
    const headers = ['SKU', 'Producto', 'Variante', 'Precio', 'Disponible', 'En mano', 'Reservado', 'Valor Total'];
    const rows = inventoryItems.map(item => [
      item.sku,
      item.productTitle,
      item.variantTitle,
      item.price.toFixed(2),
      item.available,
      item.onHand,
      item.reserved,
      (item.available * item.price).toFixed(2)
    ]);
    
    const csvContent = [
      `Inventario - ${location.name} - ${new Date().toLocaleDateString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-${location.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  
  return (
    <s-page 
      heading={location.name}
      backAction
      onBackAction={() => navigate('/app')}
    >
      {/* Información de la ubicación */}
      <s-section>
        <s-card>
          <s-layout>
            <s-layout-section variant="one-half">
              <s-stack gap="base">
                <s-heading>Información de la Ubicación</s-heading>
                <s-stack gap="tight">
                  <s-text>
                    <s-text emphasis="strong">Dirección:</s-text> {location.address?.address1 || 'No especificada'}
                  </s-text>
                  {location.address?.address2 && (
                    <s-text>{location.address.address2}</s-text>
                  )}
                  <s-text>
                    <s-text emphasis="strong">Ciudad:</s-text> {location.address?.city || 'N/A'}
                    {location.address?.province && `, ${location.address.province}`}
                  </s-text>
                  <s-text>
                    <s-text emphasis="strong">País:</s-text> {location.address?.country || 'N/A'}
                    {location.address?.zip && ` - CP: ${location.address.zip}`}
                  </s-text>
                </s-stack>
              </s-stack>
            </s-layout-section>
            
            <s-layout-section variant="one-half">
              <s-stack gap="base">
                <s-heading>Estado</s-heading>
                <s-badge tone={location.isActive ? 'success' : 'critical'} size="large">
                  {location.isActive ? 'Ubicación Activa' : 'Ubicación Inactiva'}
                </s-badge>
              </s-stack>
            </s-layout-section>
          </s-layout>
        </s-card>
      </s-section>
      
      {/* Métricas de la ubicación */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Productos únicos</s-text>
                <s-text size="large" emphasis="bold">{stats.totalProducts}</s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Items disponibles</s-text>
                <s-text size="large" emphasis="bold">{stats.totalItems.toLocaleString()}</s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Valor total</s-text>
                <s-text size="large" emphasis="bold">
                  ${stats.totalValue.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-quarter">
            <s-card>
              <s-stack gap="tight">
                <s-text subdued>Items reservados</s-text>
                <s-text size="large" emphasis="bold">{stats.totalReserved.toLocaleString()}</s-text>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Top productos por valor */}
      <s-section>
        <s-card>
          <s-heading>Top 10 Productos por Valor</s-heading>
          <div style={{ width: '100%', height: 300, marginTop: 20 }}>
            <ResponsiveContainer>
              <BarChart data={topProducts} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString('es-DO')}`} />
                <Bar dataKey="value" fill="#008060" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </s-card>
      </s-section>
      
      {/* Tabla de inventario detallado */}
      <s-section>
        <s-card>
          <s-stack direction="inline" alignment="space-between">
            <s-heading>Inventario Detallado ({inventoryItems.length} productos)</s-heading>
            <s-button onClick={exportLocationCSV}>
              Exportar Inventario
            </s-button>
          </s-stack>
          
          <s-table style={{ marginTop: '1rem' }}>
            <s-table-head>
              <s-table-row>
                <s-table-header>SKU</s-table-header>
                <s-table-header>Producto</s-table-header>
                <s-table-header>Variante</s-table-header>
                <s-table-header>Precio</s-table-header>
                <s-table-header>Disponible</s-table-header>
                <s-table-header>En mano</s-table-header>
                <s-table-header>Reservado</s-table-header>
                <s-table-header>Valor</s-table-header>
              </s-table-row>
            </s-table-head>
            <s-table-body>
              {inventoryItems.map((item) => (
                <s-table-row key={item.id}>
                  <s-table-cell>{item.sku}</s-table-cell>
                  <s-table-cell>{item.productTitle}</s-table-cell>
                  <s-table-cell>{item.variantTitle}</s-table-cell>
                  <s-table-cell>${item.price.toFixed(2)}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={item.available > 10 ? 'success' : item.available > 0 ? 'warning' : 'critical'}>
                      {item.available}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{item.onHand}</s-table-cell>
                  <s-table-cell>{item.reserved}</s-table-cell>
                  <s-table-cell>
                    ${(item.available * item.price).toLocaleString('es-DO', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-card>
      </s-section>
    </s-page>
  );
}