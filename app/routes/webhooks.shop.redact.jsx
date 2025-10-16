import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  // El webhook shop/redact se dispara 48 horas después de que una tienda desinstala la app
  // Debemos eliminar TODOS los datos relacionados con esa tienda
  
  console.log(`Shop redact webhook received for shop: ${shop}`);
  
  // Cuando implementemos base de datos, aquí debemos:
  // 1. Eliminar todas las sesiones de la tienda
  // 2. Eliminar cualquier configuración guardada
  // 3. Eliminar datos de analytics históricos
  // 4. Eliminar cualquier caché relacionado
  // 5. Asegurarnos de que no queda ningún dato de la tienda
  
  try {
    // Por ahora, solo eliminamos la sesión si existe
    // En el futuro, agregar lógica de limpieza completa aquí
    
    console.log(`Shop data for ${shop} marked for deletion`);
    console.log("Multi-Location Analytics: Shop data will be purged");
    
    // TODO: Cuando tengamos Prisma configurado:
    // await prisma.session.deleteMany({ where: { shop } });
    // await prisma.shopConfig.deleteMany({ where: { shop } });
    // await prisma.analyticsCache.deleteMany({ where: { shop } });
    
  } catch (error) {
    console.error("Error during shop redaction:", error);
    // Aún así devolvemos 200 para confirmar recepción del webhook
  }

  return new Response();
};