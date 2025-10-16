import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Obtener todas las ubicaciones primero
    const locationsResponse = await admin.graphql(
      `#graphql
        query getLocations {
          locations(first: 10) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `
    );
    
    const locationsData = await locationsResponse.json();
    const locations = locationsData.data?.locations?.edges || [];
    
    // Obtener productos con inventario
    const productsResponse = await admin.graphql(
      `#graphql
        query getProducts {
          products(first: 100) {
            edges {
              node {
                id
                title
                vendor
                productType
                totalInventory
                totalVariants
                priceRangeV2 {
                  minVariantPrice {
                    amount
                  }
                  maxVariantPrice {
                    amount
                  }
                }
                images(first: 1) {
                  nodes {
                    url
                    altText
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      sku
                      barcode
                      inventoryItem {
                        id
                        inventoryLevels(first: 10) {
                          edges {
                            node {
                              location {
                                id
                                name
                              }
                              quantities(names: ["available", "reserved", "on_hand", "committed"]) {
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
    
    const productsData = await productsResponse.json();
    const products = productsData.data?.products?.edges || [];
    
    // Procesar datos de inventario
    const inventoryData = products.map(({ node: product }) => {
      let totalAvailable = 0;
      let totalReserved = 0;
      let totalOnHand = 0;
      const locationInventory = {};
      
      product.variants.edges.forEach(({ node: variant }) => {
        variant.inventoryItem?.inventoryLevels?.edges?.forEach(({ node: level }) => {
          const locationId = level.location.id;
          const locationName = level.location.name;
          
          if (!locationInventory[locationId]) {
            locationInventory[locationId] = {
              name: locationName,
              available: 0,
              reserved: 0,
              onHand: 0
            };
          }
          
          level.quantities.forEach(q => {
            if (q.name === 'available') {
              locationInventory[locationId].available += q.quantity;
              totalAvailable += q.quantity;
            } else if (q.name === 'reserved') {
              locationInventory[locationId].reserved += q.quantity;
              totalReserved += q.quantity;
            } else if (q.name === 'on_hand') {
              locationInventory[locationId].onHand += q.quantity;
              totalOnHand += q.quantity;
            }
          });
        });
      });
      
      const avgPrice = (
        parseFloat(product.priceRangeV2.minVariantPrice.amount) + 
        parseFloat(product.priceRangeV2.maxVariantPrice.amount)
      ) / 2;
      
      return {
        id: product.id,
        title: product.title,
        vendor: product.vendor || 'Sin proveedor',
        type: product.productType || 'Sin categoría',
        image: product.images.nodes[0]?.url || null,
        variantsCount: product.totalVariants,
        avgPrice,
        inventory: {
          available: totalAvailable,
          reserved: totalReserved,
          onHand: totalOnHand,
          value: totalAvailable * avgPrice
        },
        locationInventory,
        lowStock: totalAvailable < 10,
        outOfStock: totalAvailable === 0
      };
    });
    
    // Calcular totales
    const totals = inventoryData.reduce((acc, item) => ({
      products: acc.products + 1,
      available: acc.available + item.inventory.available,
      reserved: acc.reserved + item.inventory.reserved,
      value: acc.value + item.inventory.value,
      lowStock: acc.lowStock + (item.lowStock ? 1 : 0),
      outOfStock: acc.outOfStock + (item.outOfStock ? 1 : 0)
    }), { products: 0, available: 0, reserved: 0, value: 0, lowStock: 0, outOfStock: 0 });
    
    return { 
      products: inventoryData,
      locations,
      totals
    };
    
  } catch (error) {
    console.error("Error loading inventory:", error);
    return { 
      products: [],
      locations: [],
      totals: { products: 0, available: 0, reserved: 0, value: 0, lowStock: 0, outOfStock: 0 }
    };
  }
};

export default function Inventario() {
  const { products, locations, totals } = useLoaderData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, low-stock, out-of-stock, in-stock
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('title'); // title, available, value
  
  // Obtener tipos únicos
  const productTypes = [...new Set(products.map(p => p.type))].filter(Boolean);
  
  // Filtrar productos
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.vendor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' ||
                           (filterStatus === 'low-stock' && product.lowStock && !product.outOfStock) ||
                           (filterStatus === 'out-of-stock' && product.outOfStock) ||
                           (filterStatus === 'in-stock' && !product.lowStock && !product.outOfStock);
      
      const matchesType = filterType === 'all' || product.type === filterType;
      
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'available':
          return b.inventory.available - a.inventory.available;
        case 'value':
          return b.inventory.value - a.inventory.value;
        default:
          return 0;
      }
    });
  
  // Datos para gráfica de distribución
  const distributionData = locations.map(({ node: location }) => {
    const locationId = location.id;
    let totalItems = 0;
    
    products.forEach(product => {
      if (product.locationInventory[locationId]) {
        totalItems += product.locationInventory[locationId].available;
      }
    });
    
    return {
      name: location.name,
      items: totalItems
    };
  });
  
  return (
    <s-page>
      {/* Header */}
      <s-section>
        <s-layout>
          <s-layout-section variant="full">
            <s-stack gap="tight">
              <s-stack direction="inline" alignment="space-between">
                <div>
                  <s-heading size="extra-large">Gestión de Inventario</s-heading>
                  <s-text subdued size="medium">
                    Control completo del inventario en todas las sucursales
                  </s-text>
                </div>
                <s-stack direction="inline" gap="tight">
                  <s-button variant="secondary" onClick={() => navigate('/app/inventario/transferencias')}>
                    Transferencias
                  </s-button>
                  <s-button onClick={() => navigate('/app/inventario/ajustes')}>
                    Ajustar Stock
                  </s-button>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* KPIs */}
      <s-section>
        <s-layout>
          <s-layout-section variant="one-fifth">
            <s-card style={{ borderTop: '3px solid #008060' }}>
              <s-stack gap="tight" alignment="center">
                <s-text subdued size="small">Productos Totales</s-text>
                <s-text size="large" emphasis="bold">{totals.products}</s-text>
                <s-badge tone="info">SKUs activos</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-fifth">
            <s-card style={{ borderTop: '3px solid #5630ff' }}>
              <s-stack gap="tight" alignment="center">
                <s-text subdued size="small">Stock Disponible</s-text>
                <s-text size="large" emphasis="bold">{totals.available.toLocaleString()}</s-text>
                <s-badge tone="success">unidades</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-fifth">
            <s-card style={{ borderTop: '3px solid #e3b505' }}>
              <s-stack gap="tight" alignment="center">
                <s-text subdued size="small">Valor Total</s-text>
                <s-text size="large" emphasis="bold">
                  ${(totals.value / 1000).toFixed(0)}k
                </s-text>
                <s-badge tone="info">valorizado</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-fifth">
            <s-card style={{ borderTop: '3px solid #ff6b6b' }}>
              <s-stack gap="tight" alignment="center">
                <s-text subdued size="small">Stock Bajo</s-text>
                <s-text size="large" emphasis="bold" tone="warning">{totals.lowStock}</s-text>
                <s-badge tone="warning">productos</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
          
          <s-layout-section variant="one-fifth">
            <s-card style={{ borderTop: '3px solid #d83c3e' }}>
              <s-stack gap="tight" alignment="center">
                <s-text subdued size="small">Sin Stock</s-text>
                <s-text size="large" emphasis="bold" tone="critical">{totals.outOfStock}</s-text>
                <s-badge tone="critical">agotados</s-badge>
              </s-stack>
            </s-card>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Filtros */}
      <s-section>
        <s-card style={{ background: '#f6f6f7' }}>
          <s-layout>
            <s-layout-section variant="one-third">
              <s-text-field
                label="Buscar producto"
                labelHidden
                placeholder="Buscar por nombre o proveedor..."
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
                    { label: 'Todos los estados', value: 'all' },
                    { label: 'Stock bajo', value: 'low-stock' },
                    { label: 'Sin stock', value: 'out-of-stock' },
                    { label: 'En stock', value: 'in-stock' }
                  ]}
                  value={filterStatus}
                  onChange={(value) => setFilterStatus(value)}
                />
                
                <s-select
                  label="Categoría"
                  labelHidden
                  options={[
                    { label: 'Todas las categorías', value: 'all' },
                    ...productTypes.map(type => ({ label: type, value: type }))
                  ]}
                  value={filterType}
                  onChange={(value) => setFilterType(value)}
                />
                
                <s-select
                  label="Ordenar por"
                  labelHidden
                  options={[
                    { label: 'Nombre A-Z', value: 'title' },
                    { label: 'Mayor stock', value: 'available' },
                    { label: 'Mayor valor', value: 'value' }
                  ]}
                  value={sortBy}
                  onChange={(value) => setSortBy(value)}
                />
              </s-stack>
            </s-layout-section>
          </s-layout>
        </s-card>
      </s-section>
      
      {/* Gráfica de distribución */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-heading>Distribución de Inventario por Sucursal</s-heading>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="items" fill="#008060" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </s-stack>
        </s-card>
      </s-section>
      
      {/* Lista de productos */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" alignment="space-between">
              <s-heading>Inventario de Productos</s-heading>
              <s-text subdued>{filteredProducts.length} productos encontrados</s-text>
            </s-stack>
            
            <div style={{ overflowX: 'auto' }}>
              <s-table>
                <s-table-head>
                  <s-table-row>
                    <s-table-header>Producto</s-table-header>
                    <s-table-header>Categoría</s-table-header>
                    <s-table-header>Stock Total</s-table-header>
                    <s-table-header>Reservado</s-table-header>
                    <s-table-header>Valor</s-table-header>
                    <s-table-header>Estado</s-table-header>
                    <s-table-header>Acciones</s-table-header>
                  </s-table-row>
                </s-table-head>
                <s-table-body>
                  {filteredProducts.map((product) => (
                    <s-table-row key={product.id} hover style={{ cursor: 'pointer' }}>
                      <s-table-cell>
                        <s-stack direction="inline" gap="tight" alignment="center">
                          {product.image && (
                            <img 
                              src={product.image} 
                              alt={product.title}
                              style={{ 
                                width: '40px', 
                                height: '40px', 
                                objectFit: 'cover',
                                borderRadius: '4px'
                              }}
                            />
                          )}
                          <s-stack gap="extra-tight">
                            <s-text emphasis="strong">{product.title}</s-text>
                            <s-text size="small" subdued>{product.vendor}</s-text>
                          </s-stack>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{product.type}</s-table-cell>
                      <s-table-cell>
                        <s-text emphasis={product.lowStock ? 'strong' : undefined} tone={product.outOfStock ? 'critical' : product.lowStock ? 'warning' : undefined}>
                          {product.inventory.available.toLocaleString()}
                        </s-text>
                      </s-table-cell>
                      <s-table-cell>{product.inventory.reserved.toLocaleString()}</s-table-cell>
                      <s-table-cell>
                        ${product.inventory.value.toLocaleString('es-DO', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </s-table-cell>
                      <s-table-cell>
                        {product.outOfStock ? (
                          <s-badge tone="critical">Sin stock</s-badge>
                        ) : product.lowStock ? (
                          <s-badge tone="warning">Stock bajo</s-badge>
                        ) : (
                          <s-badge tone="success">En stock</s-badge>
                        )}
                      </s-table-cell>
                      <s-table-cell>
                        <s-button variant="tertiary" size="small" onClick={() => navigate(`/app/producto/${product.id.split('/').pop()}`)}>
                          Ver detalles
                        </s-button>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                  
                  {filteredProducts.length === 0 && (
                    <s-table-row>
                      <s-table-cell colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                        <s-stack gap="base" alignment="center">
                          <div style={{ fontSize: '48px' }}>📦</div>
                          <s-text subdued>No se encontraron productos con los filtros seleccionados</s-text>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  )}
                </s-table-body>
              </s-table>
            </div>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}