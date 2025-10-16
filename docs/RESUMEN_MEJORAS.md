# 🎯 RESUMEN EJECUTIVO - Mejoras de Precisión

## Estado Actual: 80% Preciso ⚠️

### ✅ LO QUE ESTÁ BIEN (4/5 métricas críticas)
1. **Ventas totales** - Usa `currentTotalPriceSet` correctamente
2. **Filtrado de órdenes** - Excluye canceladas, solo cuenta pagadas
3. **Productos únicos** - Sin duplicados, usa ID en vez de título
4. **Paginación robusta** - Carga hasta 5000 órdenes y 2000 productos

### 🔴 PROBLEMA CRÍTICO (Arreglar HOY)

**Revenue por producto está MAL calculado**

Código actual divide el total de la orden equitativamente entre todos los productos:
```javascript
// Si una orden tiene $100 con 2 productos:
// - Producto A ($80) → se registra como $50 ❌
// - Producto B ($20) → se registra como $50 ❌
const estimatedItemRevenue = orderAmount / itemsInOrder; // INCORRECTO
```

**Solución:** Usar el precio real del lineItem
```javascript
// Cambiar línea 512-515 por:
const itemPrice = parseFloat(item.node.originalTotalSet?.shopMoney?.amount || 0);
globalTopProducts[productId].revenue += itemPrice; // ✅ CORRECTO
```

**Y agregar al query GraphQL (línea 96):**
```graphql
lineItems(first: 50) {
  edges {
    node {
      title
      quantity
      originalTotalSet {  # ← AGREGAR ESTE CAMPO
        shopMoney {
          amount
        }
      }
      variant { ... }
    }
  }
}
```

**Impacto:** Sin esto, los ingresos por producto pueden estar incorrectos hasta 50%+

---

### ⚠️ PROBLEMAS IMPORTANTES (Arreglar esta semana)

**1. Empleados son FICTICIOS** (Viola regla de "solo datos reales")
```javascript
// Línea 579 - Nombres hardcodeados:
'Pitagora': ['María R.', 'Juan P.', 'Ana G.'], // ❌ Inventados
```

**Opciones:**
- A) Usar `staffMember` de Shopify si está disponible
- B) Extraer de notas/tags de órdenes
- C) Deshabilitar hasta tener datos reales

**2. Costos de inventario faltantes**
```javascript
// Línea 403 - Si unitCost es null, cuenta como $0
const unitCost = variant.node.inventoryItem?.unitCost?.amount || null;
// Subestima el valor del inventario
```

**Solución:** Estimar 40% del precio si no hay costo real, pero marcarlo como "estimado"

---

### 🟢 MEJORAS MENORES (Nice to have)

1. **Rotación de inventario** - Hardcodeada en -2%, debería calcularse
2. **Límites configurables** - 5000 órdenes fijo, hacer dinámico por plan

---

## 📋 PLAN DE ACCIÓN (4 horas total)

### HOY (30 min) 🔴
- [ ] Agregar `originalTotalSet` al query de lineItems
- [ ] Cambiar cálculo de revenue a usar precio real del item
- [ ] Validar con Shopify Admin que los números coincidan

### ESTA SEMANA (2 horas) ⚠️
- [ ] Investigar si `staffMember` está disponible en Shopify
- [ ] Implementar extracción real de empleados o deshabilitar
- [ ] Mejorar manejo de costos null con estimación marcada

### PRÓXIMAS 2 SEMANAS (1.5 horas) 🟢
- [ ] Implementar cálculo real de rotación de inventario
- [ ] Hacer límites de paginación configurables

---

## 🎯 OBJETIVO

Pasar de **80%** → **99.9%** de precisión en métricas críticas

**Tiempo estimado:** 3-4 horas de desarrollo + testing

---

## 📊 CÓMO VALIDAR

Después de cada cambio, comparar con Shopify Admin:

```
Dashboard          vs    Shopify Admin
-------------------------------------------------
Ventas totales     →     Analytics > Ventas
Revenue Producto A →     Productos > [Producto] > Analytics
Inventario total   →     Productos > Inventario
```

Si los números coinciden ±1%, está correcto ✅

---

## 📁 ARCHIVOS

**Análisis completo:** `~/Desktop/ANALISIS_PRECISION_DATOS.md`  
**Código a modificar:** `~/multi-location-review/app/routes/app._index.jsx`

Líneas específicas a cambiar:
- **96-110** → Agregar `originalTotalSet` al query
- **512-515** → Cambiar cálculo de revenue
- **579-591** → Solucionar empleados ficticios
- **403** → Mejorar manejo de costos null
