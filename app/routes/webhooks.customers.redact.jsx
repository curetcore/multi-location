import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  // El webhook customers/redact se dispara cuando un cliente solicita eliminar sus datos
  // Debemos eliminar permanentemente todos los datos del cliente
  
  console.log(`Customer redact webhook received for shop: ${shop}`);
  console.log(`Customer ID: ${payload.customer?.id}`);
  console.log(`Email: ${payload.customer?.email}`);
  
  // En nuestra app, no almacenamos datos específicos de clientes
  // Solo procesamos datos agregados de órdenes para analytics
  
  // Si en el futuro almacenamos datos de clientes, implementar aquí:
  // 1. Buscar todos los registros con payload.customer.id
  // 2. Eliminar permanentemente esos registros
  // 3. Registrar la eliminación para auditoría
  // 4. Confirmar que no quedan datos del cliente
  
  // Por ahora, solo registramos la solicitud
  console.log("Multi-Location Analytics: No customer-specific data to redact");

  return new Response();
};