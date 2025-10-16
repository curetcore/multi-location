# 🎨 Guía de Estilo Visual - Multi-Location Analytics

## 📌 Milestone: Estilo Visual Definitivo
**Fecha**: Octubre 2024  
**Estado**: ✅ Aprobado

Este documento define el estilo visual oficial para toda la aplicación Multi-Location Analytics.

## 🎨 Paleta de Colores

### Colores Primarios
```css
/* Gradiente principal del header */
background: linear-gradient(135deg, #1e293b 0%, #334155 100%)

/* Grises principales */
--dark-primary: #1e293b    /* Gris oscuro principal */
--dark-secondary: #334155  /* Gris oscuro secundario */
--gray-icons: #475569      /* Iconos y elementos secundarios */
--gray-text: #6b7280       /* Texto secundario */
--gray-bg: #f3f4f6         /* Fondos claros */
--white: #ffffff           /* Fondo de tarjetas */
```

### Colores de Estado
```css
/* Solo para indicadores de tendencia */
--positive: #334155        /* Tendencias positivas (gris oscuro) */
--negative: #ef4444        /* Tendencias negativas (rojo) */
--success: #10b981         /* Estado activo (verde) */
```

## 🏗️ Estructura Visual

### Headers
- Gradiente oscuro de #1e293b a #334155
- Altura: 40px padding vertical
- Sombra sutil: `0 4px 20px rgba(0,0,0,0.08)`

### Tarjetas (Cards)
```css
{
  background: 'white',
  borderRadius: '12px',
  padding: '25px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  border: 'none',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
}
```

### Iconos
- Tamaño contenedor: 48x48px
- Fondo: #f3f4f6 (gris claro)
- Border radius: 12px
- Color SVG: #475569 (gris medio)
- Tamaño SVG: 24x24px

## 📊 Componentes de Datos

### KPIs
- Grid de 4 columnas en desktop
- Sin bordes de color
- Hover effect: translateY(-2px) + sombra aumentada

### Tendencias
- Flecha y porcentaje en color #334155 (positivo) o #ef4444 (negativo)
- Texto descriptivo en #6b7280

## 🔤 Tipografía

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

### Tamaños
- Título principal: 42px, peso 700
- Subtítulos: 24px, peso 600
- Valores KPI: 32px, peso 700
- Texto normal: 16px
- Texto secundario: 14px
- Labels: 14px, color #6b7280

## ✨ Efectos y Animaciones

### Hover en tarjetas
```css
onMouseEnter: {
  transform: 'translateY(-2px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
}
```

### Transiciones
- Duración estándar: 0.2s - 0.3s
- Easing: ease

## 🚫 Lo que NO hacer

1. **NO usar colores brillantes o saturados** en elementos principales
2. **NO usar emojis** - solo iconos SVG profesionales
3. **NO usar múltiples colores** - mantener paleta mínima
4. **NO usar bordes de colores** en tarjetas
5. **NO usar gradientes coloridos** - solo el gradiente oscuro del header

## ✅ Mejores Prácticas

1. **Minimalismo**: Menos es más
2. **Consistencia**: Usar siempre la misma paleta
3. **Profesionalismo**: Aspecto corporativo y serio
4. **Legibilidad**: Alto contraste entre texto y fondo
5. **Jerarquía visual**: Usar tamaños y pesos para crear jerarquía

## 📱 Responsive

- Desktop: Grid de 4 columnas para KPIs
- Tablet: Grid de 2 columnas
- Mobile: Stack vertical (1 columna)

## 🎯 Objetivo del Diseño

Crear una interfaz profesional, minimalista y enfocada en datos que transmita:
- **Confianza**: A través de colores sobrios
- **Claridad**: Con jerarquía visual clara
- **Modernidad**: Con efectos sutiles y diseño limpio
- **Eficiencia**: Mostrando datos de forma directa

---

**Este es nuestro estilo visual definitivo. Todos los componentes futuros deben seguir estas guías.**