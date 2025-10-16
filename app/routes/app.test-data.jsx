import { json } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Test 1: Shop Info
    const shopResponse = await admin.graphql(
      `#graphql
        query {
          shop {
            name
            currencyCode
            email
            id
          }
        }
      `
    );
    const shopData = await shopResponse.json();
    
    // Test 2: Recent Orders
    const ordersResponse = await admin.graphql(
      `#graphql
        query {
          orders(first: 10, reverse: true) {
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
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
              }
            }
          }
        }
      `
    );
    const ordersData = await ordersResponse.json();
    
    // Test 3: Products
    const productsResponse = await admin.graphql(
      `#graphql
        query {
          products(first: 10) {
            edges {
              node {
                id
                title
                status
                totalInventory
              }
            }
          }
        }
      `
    );
    const productsData = await productsResponse.json();
    
    // Test 4: Locations
    const locationsResponse = await admin.graphql(
      `#graphql
        query {
          locations(first: 10) {
            edges {
              node {
                id
                name
                isActive
                address {
                  city
                  country
                }
              }
            }
          }
        }
      `
    );
    const locationsData = await locationsResponse.json();
    
    return json({
      shop: shopData.data?.shop || null,
      ordersCount: ordersData.data?.orders?.edges?.length || 0,
      orders: ordersData.data?.orders?.edges || [],
      productsCount: productsData.data?.products?.edges?.length || 0,
      products: productsData.data?.products?.edges || [],
      locationsCount: locationsData.data?.locations?.edges?.length || 0,
      locations: locationsData.data?.locations?.edges || [],
      errors: {
        shop: shopData.errors || null,
        orders: ordersData.errors || null,
        products: productsData.errors || null,
        locations: locationsData.errors || null
      }
    });
  } catch (error) {
    return json({
      error: error.message,
      stack: error.stack
    });
  }
};

export default function TestData() {
  const data = useLoaderData();
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Test de Datos - Multi-Location Analytics</h1>
      
      <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Resumen</h2>
        <ul>
          <li>Tienda: {data.shop?.name || 'NO DATA'}</li>
          <li>Órdenes encontradas: {data.ordersCount}</li>
          <li>Productos encontrados: {data.productsCount}</li>
          <li>Ubicaciones encontradas: {data.locationsCount}</li>
        </ul>
      </div>
      
      {data.error && (
        <div style={{ background: '#fee', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2>ERROR GENERAL</h2>
          <pre>{data.error}</pre>
          <pre style={{ fontSize: '12px' }}>{data.stack}</pre>
        </div>
      )}
      
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Datos Raw</h2>
        <pre style={{ overflow: 'auto', maxHeight: '600px' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}