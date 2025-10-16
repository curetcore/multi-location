# 🏪 Multi-Location Analytics

Aplicación Shopify para análisis y gestión de inventario en múltiples sucursales con diseño moderno inspirado en Airtable.

## 🚀 Versión 1.1.0 - Actualización Mayor

### Nuevas Características
- ✨ **Nuevo diseño Airtable-inspired** con interfaz suave y moderna
- 📊 **Dashboard mejorado** con métricas en tiempo real de 30 días
- 🏆 **Top 9 productos** más vendidos en grid visual
- 👥 **Ranking de empleados** con cálculo automático de comisiones
- 🏢 **Indicadores de sucursales** activas/inactivas
- 📦 **Total de productos** en el catálogo
- ⚙️ **Página de configuración** completamente rediseñada

## 📊 Estado Actual del Proyecto

### ✅ Completado
- Dashboard principal con todas las métricas
- Inventario por sucursal con totales sticky
- Top 9 productos más vendidos
- Ranking de empleados basado en órdenes reales
- Página de configuración funcional
- Diseño unificado estilo Airtable
- Datos 100% reales de Shopify API (NO MOCK DATA)

### 📋 Pendiente para v1.2.0
- [ ] Sección de rendimiento por sucursal
- [ ] Sistema de alertas y notificaciones
- [ ] Implementación de caché para datos históricos
- [ ] Base de datos con Prisma para históricos
- [ ] Exportación a Excel/CSV
- [ ] Gráficos de tendencias

## 🛠 Stack Tecnológico

- **Frontend**: React 18.3.1 con React Router 7.9
- **Backend**: Shopify App (Node.js)
- **Estilos**: CSS-in-JS (inline styles)
- **API**: Shopify Admin GraphQL API
- **Base de Datos**: Prisma (preparado, no implementado)

## 📋 Requisitos

- Node.js >= 20.10
- Shopify Partner Account
- Shopify Development Store
- Shopify CLI

## 🔧 Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/curetcore/multi-location.git
cd multi-location-analytics

# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev
```

## 🌐 Deployment

La aplicación está desplegada en producción en:
- **URL**: https://shopify.curetshop.com
- **Tienda**: pitagora-2.myshopify.com

## 📚 Documentación

- [Documentación Completa](./DOCUMENTATION.md) - **NUEVO**: Guía completa del proyecto
- [Sesión de Trabajo](./SESSION_NOTES.md) - **NUEVO**: Resumen de cambios recientes

## 🎨 Diseño y UX

El nuevo diseño está inspirado en Airtable con:
- Colores suaves y modernos
- Bordes redondeados
- Efectos hover sutiles
- Tipografía clara y legible
- Espaciado consistente
- Tablas con estilo moderno

### Paleta de Colores
- Background: `#f8f9fa`
- Cards: `white`
- Borders: `#e5e7eb`
- Text Primary: `#111827`
- Text Secondary: `#6b7280`
- Accent: `#111827`

## 🔄 Últimos Cambios (Oct 16, 2024)

1. **Header Renovado**
   - Nuevo diseño con cards de métricas
   - Indicadores de sucursales activas
   - Métrica de total de productos

2. **Empleados con Datos Reales**
   - Asignación automática basada en ubicación física
   - Cálculo de comisiones del 1%
   - Métricas extraídas de órdenes reales

3. **Diseño Unificado**
   - Todas las tablas con estilo Airtable
   - Cards con hover effects
   - Navegación simplificada

## 🚀 Próximos Pasos

Para continuar en la próxima sesión:

1. **Performance**
   - Implementar sistema de caché
   - Optimizar queries GraphQL
   - Lazy loading de datos

2. **Nuevas Secciones**
   - Rendimiento por período
   - Comparativas entre sucursales
   - Predicciones y tendencias

3. **Integraciones**
   - Webhooks para actualizaciones en tiempo real
   - API REST para sistemas externos
   - Notificaciones por email

## 🤝 Contribuir

Este es un proyecto privado. Para contribuir, contactar al equipo de desarrollo.

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

## 👥 Equipo

- **Desarrollo**: Claude AI + Ronaldo Paulino
- **Cliente**: CuretShop / Pitagora

---

*Última actualización: ${new Date().toLocaleDateString('es-DO')}*