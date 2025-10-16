# 📊 Estado de Datos: Reales vs Mock

## 🟢 Datos REALES de Shopify

### Dashboard Principal (app._index.jsx)
- ✅ **Inventario por ubicación**: Datos reales via GraphQL
- ✅ **Órdenes de últimos 30 días**: Datos reales via GraphQL  
- ✅ **Métricas calculadas**:
  - Stock disponible, reservado, on hand
  - Ventas totales y unidades vendidas
  - Valor del inventario
  - KPIs: Sell-through rate, rotación, cobertura

### Página de Inventario (app.inventario.jsx)
- ✅ **Productos y variantes**: Datos reales
- ✅ **Niveles de inventario**: Por ubicación real
- ✅ **Precios y valores**: Calculados con precios reales
- ✅ **Estados de stock**: Basados en cantidades reales

### Configuración (app.configuracion.jsx)
- ✅ **Información de la tienda**: Datos reales (nombre, email, moneda, etc.)

## 🔴 Datos SIMULADOS (Mock)

### Página de Sucursales (app.sucursales.jsx)
- ❌ **Ventas mensuales**: `Math.random() * 50000 + 10000`
- ❌ **Eficiencia**: `Math.random() * 40 + 60`
- ❌ **Personal**: `Math.random() * 8 + 2`

### Página de Analytics (app.analytics.jsx)
- ❌ **Datos históricos de 90 días**: Completamente simulados
- ❌ **Ventas por mes**: Array generado con random
- ❌ **Performance de productos**: Top 10 simulado
- ❌ **Métricas de retención**: Random
- ❌ **Tasa de conversión**: Random

### Dashboard Principal - Elementos Mock
- ❌ **Tendencias (+12% mes)**: Valores hardcodeados
- ❌ **Comparaciones de período**: No calculadas realmente

## 🔧 Soluciones Necesarias

### 1. Reemplazar datos mock en Sucursales
```javascript
// En vez de:
monthlySales: Math.round(Math.random() * 50000 + 10000)

// Usar:
// Query real de órdenes filtradas por fecha y ubicación
```

### 2. Implementar históricos reales en Analytics
- Necesitamos almacenar datos históricos en base de datos
- O hacer queries más extensas a Shopify (puede ser lento)

### 3. Calcular tendencias reales
- Comparar períodos actuales vs anteriores
- Basarse en datos reales, no porcentajes fijos

## 📝 Por qué hay datos Mock

1. **Limitaciones de API**: Shopify limita queries grandes
2. **Performance**: Queries históricas extensas son lentas
3. **Desarrollo inicial**: Para probar visualizaciones
4. **Datos no disponibles**: Como "personal por sucursal"

## 🚀 Plan de Acción

### Fase 1: Datos críticos (Inmediato)
- [ ] Reemplazar ventas simuladas en Sucursales
- [ ] Calcular eficiencia real basada en sell-through
- [ ] Eliminar indicadores hardcodeados

### Fase 2: Base de datos (1 semana)
- [ ] Implementar Prisma para almacenar históricos
- [ ] Crear jobs para sincronizar datos diariamente
- [ ] Cache de métricas calculadas

### Fase 3: Analytics real (2 semanas)
- [ ] Sistema de agregación de datos
- [ ] Cálculos de tendencias reales
- [ ] Comparaciones período vs período

## ⚠️ Impacto en Usuario

**Actual**: Los datos pueden parecer inconsistentes o cambiar aleatoriamente
**Esperado**: Datos estables y confiables que reflejen la realidad del negocio

## 💡 Recomendaciones

1. **Transparencia**: Indicar claramente qué datos son estimados
2. **Gradual**: Ir reemplazando mock por reales progresivamente
3. **Cache**: Implementar cache para datos costosos
4. **Webhooks**: Usar webhooks de Shopify para actualizaciones en tiempo real