# 🔧 Corrección de Problemas de Datos

## Problemas Identificados

### 1. Inconsistencia en Totales de Órdenes
**Problema:** Mezclamos `totalPriceSet` y `currentTotalPriceSet`
- `totalPriceSet`: Precio original
- `currentTotalPriceSet`: Precio actual (con devoluciones, etc.)

**Solución:** Usar siempre `currentTotalPriceSet` para datos precisos

### 2. Límites de Datos Insuficientes
**Problema:** Solo obtenemos 250 órdenes y 100 productos
**Solución:** Aumentar límites o implementar paginación

### 3. Cálculo de Costos Incorrecto
**Problema:** Asumimos 40% del precio si no hay unitCost
**Solución:** Usar 0 o permitir configuración

### 4. Filtrado de Órdenes por Estado
**Problema:** No filtramos órdenes canceladas/devueltas
**Solución:** Filtrar por displayFinancialStatus

### 5. Productos Duplicados en Top 9
**Problema:** Un producto puede aparecer con diferentes títulos en lineItems
**Solución:** Usar ID de producto en lugar de título

## Correcciones Necesarias

### Query de Órdenes Mejorada
```graphql
query getRecentOrders($first: Int!, $query: String) {
  orders(first: $first, reverse: true, query: $query) {
    edges {
      node {
        id
        name
        currentTotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        createdAt
        displayFinancialStatus
        cancelledAt
        physicalLocation {
          id
          name
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              variant {
                id
                sku
                product {
                  id
                  title
                }
              }
              originalTotalSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Filtros Recomendados
```javascript
// Solo órdenes pagadas y no canceladas
const validOrders = orders.filter(order => {
  const status = order.node.displayFinancialStatus;
  const isCancelled = order.node.cancelledAt !== null;
  return !isCancelled && (status === 'PAID' || status === 'PARTIALLY_PAID');
});
```

### Cálculo de Inventario Mejorado
```javascript
// No asumir costos si no están disponibles
const unitCost = variant.node.inventoryItem?.unitCost?.amount;
const investment = unitCost ? quantity * parseFloat(unitCost) : null;

// Mostrar "N/A" si no hay costo real
```

### Agrupación de Productos Correcta
```javascript
// Usar ID de producto en lugar de título
const productId = item.node.variant?.product?.id;
const productTitle = item.node.variant?.product?.title || item.node.title;

if (!globalTopProducts[productId]) {
  globalTopProducts[productId] = {
    id: productId,
    title: productTitle,
    sku: item.node.variant?.sku,
    quantity: 0,
    revenue: 0,
    orders: 0
  };
}
```

## Implementación Rápida

Para una corrección inmediata:

1. Cambiar todas las referencias de `totalPriceSet` a `currentTotalPriceSet`
2. Aumentar límite de órdenes a 500
3. Filtrar órdenes canceladas
4. Usar IDs de producto para evitar duplicados

## Verificación

Después de los cambios:
1. Comparar totales con Shopify Admin
2. Verificar que productos no estén duplicados
3. Confirmar que inventario coincide
4. Validar empleados y sucursales