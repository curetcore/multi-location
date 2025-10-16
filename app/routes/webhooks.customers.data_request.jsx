import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  // El webhook customers/data_request se dispara cuando un cliente solicita sus datos
  // Según GDPR, debemos proporcionar todos los datos que tenemos sobre el cliente
  
  console.log(`Data request webhook received for shop: ${shop}`);
  console.log(`Customer ID: ${payload.customer?.id}`);
  console.log(`Email: ${payload.customer?.email}`);
  
  // En nuestra app, no almacenamos datos específicos de clientes
  // Solo procesamos datos agregados de órdenes para analytics
  
  // Si en el futuro almacenamos datos de clientes, implementar aquí:
  // 1. Buscar todos los datos relacionados con payload.customer.id
  // 2. Generar reporte con los datos
  // 3. Enviar email al cliente o notificar al merchant
  
  // Por ahora, solo registramos la solicitud
  console.log("Multi-Location Analytics: No customer-specific data stored");

  return new Response();
};