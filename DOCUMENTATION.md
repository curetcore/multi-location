# Multi-Location Analytics - Documentación Completa

## Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Componentes Principales](#componentes-principales)
6. [APIs y Queries GraphQL](#apis-y-queries-graphql)
7. [Guía de Desarrollo](#guía-de-desarrollo)
8. [Deployment](#deployment)
9. [Mantenimiento](#mantenimiento)
10. [Troubleshooting](#troubleshooting)

## Descripción General

Multi-Location Analytics es una aplicación Shopify diseñada para proporcionar análisis detallados y gestión de inventario para tiendas con múltiples ubicaciones físicas.

### Características Principales

- **Dashboard Unificado**: Vista consolidada de métricas de todas las ubicaciones
- **Análisis en Tiempo Real**: Datos actualizados de ventas, inventario y rendimiento
- **Gestión Multi-Sucursal**: Control centralizado de múltiples ubicaciones
- **Rankings y Métricas**: Top productos, empleados más vendedores, sucursales líderes
- **Diseño Moderno**: Interfaz inspirada en Airtable con estilo minimalista

### Versión Actual: 1.1.0

## Arquitectura

### Stack Tecnológico

- **Frontend**: React 18.3.1 con React Router 7.9
- **Backend**: Shopify App (Node.js)
- **Framework**: Shopify React Router App Template
- **Estilos**: CSS-in-JS (inline styles)
- **API**: Shopify Admin GraphQL API
- **Base de Datos**: Prisma (preparado para futura implementación)

### Flujo de Datos

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Shopify Store  │────▶│  GraphQL Queries │────▶│  React App      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Data Processing │     │  UI Components  │
                        └──────────────────┘     └─────────────────┘
```

## Configuración del Entorno

### Requisitos Previos

- Node.js >= 20.10
- npm o yarn
- Cuenta Shopify Partner
- Tienda de desarrollo Shopify

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/curetcore/multi-location.git
cd multi-location-analytics

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar desarrollo
npm run dev
```

### Variables de Entorno

```env
# .env
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SCOPES=read_products,read_inventory,read_locations,read_orders,read_analytics,read_metaobjects,write_metaobjects,read_customers,read_fulfillments
HOST=https://tu-dominio.com
```

## Estructura del Proyecto

```
multi-location-analytics/
├── app/
│   ├── routes/
│   │   ├── app._index.jsx          # Dashboard principal
│   │   ├── app.jsx                 # Layout y navegación
│   │   ├── app.configuracion.jsx   # Página de configuración
│   │   └── webhooks/               # Webhooks handlers
│   ├── shopify.server.js           # Configuración del servidor
│   └── root.jsx                    # Root component
├── prisma/
│   └── schema.prisma               # Schema de base de datos
├── public/                         # Assets estáticos
├── package.json
├── shopify.app.toml               # Configuración de la app
└── vite.config.js                 # Configuración de Vite
```

## Componentes Principales

### Dashboard (app._index.jsx)

El componente principal que muestra:

1. **Header con Métricas Generales**
   - Ventas totales (30 días)
   - Órdenes totales
   - Ticket promedio
   - Total de productos
   - Sucursal líder

2. **Inventario por Sucursal**
   - Tabla con productos y cantidades por ubicación
   - Totales sticky en la parte inferior
   - Exportación a CSV (próximamente)

3. **Top 9 Productos**
   - Grid 3x3 con productos más vendidos
   - Métricas de rendimiento
   - Indicadores visuales para top 3

4. **Ranking de Empleados**
   - Ventas por empleado
   - Cálculo de comisiones (1%)
   - Asignación automática por ubicación

### Configuración (app.configuracion.jsx)

Página de configuración con pestañas:

- **General**: Información básica y zona horaria
- **Notificaciones**: Alertas y reportes por email
- **Inventario**: Umbrales y configuración de stock
- **Analytics**: Períodos y actualización automática
- **Visualización**: Tema y preferencias de UI

## APIs y Queries GraphQL

### Query Principal de Datos

```graphql
query getShopData {
  shop {
    name
    currencyCode
  }
  locations(first: 10) {
    edges {
      node {
        id
        name
        isActive
      }
    }
  }
  orders(first: 250, reverse: true) {
    edges {
      node {
        id
        totalPriceSet {
          shopMoney {
            amount
          }
        }
        createdAt
        physicalLocation {
          id
          name
        }
        lineItems(first: 50) {
          edges {
            node {
              title
              quantity
            }
          }
        }
      }
    }
  }
  products(first: 100) {
    edges {
      node {
        id
        title
        variants(first: 10) {
          edges {
            node {
              sku
              price
              inventoryItem {
                inventoryLevels(first: 10) {
                  edges {
                    node {
                      location {
                        id
                        name
                      }
                      quantities(names: ["available"]) {
                        quantity
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Procesamiento de Datos

Los datos se procesan en el loader para calcular:

- Métricas agregadas por período
- Rankings de productos y empleados
- Distribución de inventario
- Comparaciones con períodos anteriores

## Guía de Desarrollo

### Convenciones de Código

1. **Estilos**: Usar estilos inline con objetos JavaScript
2. **Componentes**: Funcionales con hooks
3. **Estado**: useState y useLoaderData de React Router
4. **Naming**: camelCase para variables, PascalCase para componentes

### Ejemplo de Componente

```jsx
// Componente de tarjeta métrica
<div style={{
  background: '#f9fafb',
  borderRadius: '12px',
  padding: '16px 20px',
  border: '1px solid #e5e7eb',
  transition: 'all 0.15s ease',
  cursor: 'pointer'
}}
onMouseEnter={(e) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.transform = 'translateY(-1px)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.borderColor = '#e5e7eb';
  e.currentTarget.style.transform = 'translateY(0)';
}}>
  <p style={{ 
    color: '#6b7280', 
    fontSize: '12px', 
    margin: '0 0 6px 0', 
    fontWeight: '500', 
    textTransform: 'uppercase', 
    letterSpacing: '0.05em' 
  }}>
    Título Métrica
  </p>
  <p style={{ 
    color: '#111827', 
    fontSize: '24px', 
    fontWeight: '700', 
    margin: 0, 
    letterSpacing: '-0.5px' 
  }}>
    $123,456
  </p>
</div>
```

### Agregar Nueva Funcionalidad

1. **Nueva Ruta**: Crear archivo en `app/routes/`
2. **Navegación**: Actualizar `app.jsx` si es necesario
3. **GraphQL**: Agregar queries en el loader
4. **Estilos**: Mantener consistencia con el diseño existente

## Deployment

### Shopify CLI

```bash
# Deploy a producción
npm run deploy

# Generar extensiones
npm run generate

# Push de configuración
npm run config:push
```

### Configuración en shopify.app.toml

```toml
client_id = "tu_client_id"
name = "multi-location-analytics"
application_url = "https://tu-dominio.com"
embedded = true

[access_scopes]
scopes = "read_products,read_inventory,read_locations,read_orders,read_analytics,read_metaobjects,write_metaobjects,read_customers,read_fulfillments"
```

## Mantenimiento

### Actualizaciones Regulares

1. **Dependencias**: Actualizar mensualmente
   ```bash
   npm update
   npm audit fix
   ```

2. **Shopify API**: Revisar cambios en la API
3. **Performance**: Monitorear tiempos de carga

### Logs y Monitoreo

- Los logs se pueden ver en la consola de desarrollo
- Para producción, implementar sistema de logs externo

### Backups

- Código: Git con commits regulares
- Configuración: Exportar desde la página de configuración

## Troubleshooting

### Problemas Comunes

1. **Datos vacíos en empleados**
   - Causa: Falta de permisos para acceder a staffMember
   - Solución: Usar asignación basada en ubicación física

2. **Error de autenticación**
   - Verificar API key y secret
   - Regenerar tokens si es necesario

3. **Queries lentas**
   - Limitar cantidad de registros
   - Implementar paginación
   - Usar caché (próximamente)

### Debug

```javascript
// Agregar logs en desarrollo
console.log('Datos recibidos:', data);

// Verificar estado
console.log('Estado actual:', { 
  notifications, 
  inventory, 
  analytics 
});
```

### Soporte

Para soporte adicional:
- GitHub Issues: [https://github.com/curetcore/multi-location/issues](https://github.com/curetcore/multi-location/issues)
- Documentación Shopify: [https://shopify.dev](https://shopify.dev)
- Community Forums: [https://community.shopify.com](https://community.shopify.com)

---

## Próximas Características (v1.2.0)

- [ ] Sistema de caché con Redis
- [ ] Base de datos histórica con Prisma
- [ ] Exportación avanzada (Excel, PDF)
- [ ] Alertas automáticas por email
- [ ] API REST para integraciones externas
- [ ] Dashboard personalizable
- [ ] Análisis predictivo con ML

---

Última actualización: ${new Date().toLocaleDateString('es-DO')}