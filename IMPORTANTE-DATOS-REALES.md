# ⚠️ IMPORTANTE: SOLO DATOS REALES ⚠️

## 🚫 REGLA ABSOLUTA: NO DATOS DE PRUEBA

Este proyecto **DEBE** usar **ÚNICAMENTE DATOS REALES** de Shopify.

### ❌ PROHIBIDO:
- `Math.random()` para generar valores
- Datos hardcodeados de ejemplo
- Arrays con datos ficticios
- Valores de prueba o mock
- console.log() para debugging
- Archivos de test o debugging

### ✅ OBLIGATORIO:
- Todas las métricas deben venir de Shopify GraphQL API
- Todas las órdenes deben ser reales
- Todo el inventario debe ser real
- Todas las ubicaciones deben ser reales
- Los cálculos deben basarse en datos históricos reales

### 📊 Fuentes de Datos Aprobadas:
1. **Shopify Admin GraphQL API**
2. **Shopify REST API** (cuando sea necesario)
3. **Base de datos Prisma** (para históricos)

### 🔴 RECORDATORIO CRÍTICO:
**NUNCA** crear datos de prueba, mock o simulados. Si no hay datos reales disponibles, mostrar:
- "Sin datos disponibles"
- "0" para contadores
- Gráficas vacías
- Mensajes explicativos

---

**Este archivo es de lectura obligatoria en cada sesión de desarrollo.**

**Fecha de creación**: Octubre 2024
**Cliente**: CURET - Multi-Location Analytics
**Requisito**: DATOS 100% REALES