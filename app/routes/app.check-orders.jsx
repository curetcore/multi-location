import { json } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Query simple para verificar órdenes
    const response = await admin.rest.get({
      path: "orders/count.json",
      query: { status: "any" }
    });
    
    const orderCount = response.body.count;
    
    // También obtener algunas órdenes recientes
    const ordersResponse = await admin.rest.get({
      path: "orders.json",
      query: { 
        limit: 10,
        status: "any",
        fields: "id,name,total_price,created_at,financial_status"
      }
    });
    
    return json({
      totalOrderCount: orderCount,
      recentOrders: ordersResponse.body.orders,
      success: true
    });
    
  } catch (error) {
    return json({
      error: error.message,
      success: false
    });
  }
};

export default function CheckOrders() {
  const data = useLoaderData();
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Verificación de Órdenes</h1>
      
      {data.success ? (
        <div>
          <h2>Total de órdenes en la tienda: {data.totalOrderCount}</h2>
          
          <h3>Órdenes recientes:</h3>
          <ul>
            {data.recentOrders?.map(order => (
              <li key={order.id}>
                {order.name} - ${order.total_price} - {order.created_at}
              </li>
            ))}
          </ul>
          
          {data.totalOrderCount === 0 && (
            <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
              <p><strong>No hay órdenes en esta tienda.</strong></p>
              <p>Crea algunas órdenes de prueba en tu tienda de desarrollo para ver datos reales.</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#fee', padding: '20px' }}>
          Error: {data.error}
        </div>
      )}
    </div>
  );
}