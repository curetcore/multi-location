import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Obtener información de la tienda
    const shopResponse = await admin.graphql(
      `#graphql
        query getShop {
          shop {
            name
            email
            currencyCode
            currencyFormats {
              moneyFormat
            }
            timezoneOffsetMinutes
            timezoneAbbreviation
            billingAddress {
              city
              country
            }
          }
        }
      `
    );
    
    const shopData = await shopResponse.json();
    const shop = shopData.data?.shop;
    
    // Simular configuración guardada (en producción vendría de una DB)
    const savedConfig = {
      notifications: {
        lowStock: true,
        dailyReport: false,
        weeklyReport: true,
        monthlyReport: true,
        emailRecipients: ['admin@example.com']
      },
      inventory: {
        lowStockThreshold: 10,
        criticalStockThreshold: 5,
        autoReorder: false,
        leadTimeDays: 7
      },
      analytics: {
        defaultPeriod: '30d',
        showComparisons: true,
        autoRefresh: false,
        refreshInterval: 15
      },
      display: {
        theme: 'light',
        compactMode: false,
        showAnimations: true,
        defaultView: 'grid'
      }
    };
    
    return {
      shop,
      config: savedConfig
    };
    
  } catch (error) {
    console.error("Error loading configuration:", error);
    return {
      shop: null,
      config: {}
    };
  }
};

export default function Configuracion() {
  const { shop, config } = useLoaderData();
  const navigate = useNavigate();
  
  // Estados para cada sección de configuración
  const [notifications, setNotifications] = useState(config.notifications || {});
  const [inventory, setInventory] = useState(config.inventory || {});
  const [analytics, setAnalytics] = useState(config.analytics || {});
  const [display, setDisplay] = useState(config.display || {});
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Manejar cambios
  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleInventoryChange = (key, value) => {
    setInventory(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleAnalyticsChange = (key, value) => {
    setAnalytics(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleDisplayChange = (key, value) => {
    setDisplay(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const saveConfiguration = async () => {
    // Aquí se guardaría la configuración
    console.log('Guardando configuración...', {
      notifications,
      inventory,
      analytics,
      display
    });
    setHasChanges(false);
  };
  
  return (
    <s-page>
      {/* Header */}
      <s-section>
        <s-layout>
          <s-layout-section variant="full">
            <s-stack gap="tight">
              <s-stack direction="inline" alignment="space-between">
                <div>
                  <s-heading size="extra-large">Configuración</s-heading>
                  <s-text subdued size="medium">
                    Personaliza el comportamiento y apariencia de la aplicación
                  </s-text>
                </div>
                <s-stack direction="inline" gap="tight">
                  <s-button 
                    variant="secondary" 
                    disabled={!hasChanges}
                    onClick={() => window.location.reload()}
                  >
                    Descartar cambios
                  </s-button>
                  <s-button 
                    disabled={!hasChanges}
                    onClick={saveConfiguration}
                  >
                    Guardar cambios
                  </s-button>
                </s-stack>
              </s-stack>
            </s-stack>
          </s-layout-section>
        </s-layout>
      </s-section>
      
      {/* Información de la tienda */}
      {shop && (
        <s-section>
          <s-card style={{ background: '#f6f6f7' }}>
            <s-layout>
              <s-layout-section variant="one-half">
                <s-stack gap="tight">
                  <s-text subdued size="small">Tienda</s-text>
                  <s-text emphasis="strong">{shop.name}</s-text>
                  <s-text size="small">{shop.email}</s-text>
                </s-stack>
              </s-layout-section>
              <s-layout-section variant="one-half">
                <s-stack gap="tight" alignment="end">
                  <s-text subdued size="small">Configuración regional</s-text>
                  <s-text emphasis="strong">{shop.currencyCode}</s-text>
                  <s-text size="small">{shop.timezoneAbbreviation} ({shop.billingAddress?.city}, {shop.billingAddress?.country})</s-text>
                </s-stack>
              </s-layout-section>
            </s-layout>
          </s-card>
        </s-section>
      )}
      
      {/* Tabs de navegación */}
      <s-section>
        <s-button-group segmented>
          <s-button 
            variant={activeTab === 'general' ? 'primary' : 'tertiary'}
            onClick={() => setActiveTab('general')}
          >
            General
          </s-button>
          <s-button 
            variant={activeTab === 'notifications' ? 'primary' : 'tertiary'}
            onClick={() => setActiveTab('notifications')}
          >
            Notificaciones
          </s-button>
          <s-button 
            variant={activeTab === 'inventory' ? 'primary' : 'tertiary'}
            onClick={() => setActiveTab('inventory')}
          >
            Inventario
          </s-button>
          <s-button 
            variant={activeTab === 'analytics' ? 'primary' : 'tertiary'}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </s-button>
          <s-button 
            variant={activeTab === 'display' ? 'primary' : 'tertiary'}
            onClick={() => setActiveTab('display')}
          >
            Visualización
          </s-button>
        </s-button-group>
      </s-section>
      
      {/* Contenido según tab activa */}
      {activeTab === 'general' && (
        <s-section>
          <s-layout>
            <s-layout-section variant="full">
              <s-card>
                <s-stack gap="base">
                  <s-heading>Configuración General</s-heading>
                  <s-divider />
                  
                  <s-stack gap="loose">
                    <s-stack gap="tight">
                      <s-heading size="small">Información de la aplicación</s-heading>
                      <s-text subdued>Detalles básicos sobre la aplicación</s-text>
                      
                      <s-layout>
                        <s-layout-section variant="one-half">
                          <s-stack gap="tight">
                            <s-text subdued size="small">Versión</s-text>
                            <s-text emphasis="strong">1.0.0</s-text>
                          </s-stack>
                        </s-layout-section>
                        <s-layout-section variant="one-half">
                          <s-stack gap="tight">
                            <s-text subdued size="small">Última actualización</s-text>
                            <s-text emphasis="strong">{new Date().toLocaleDateString('es-DO')}</s-text>
                          </s-stack>
                        </s-layout-section>
                      </s-layout>
                    </s-stack>
                    
                    <s-divider />
                    
                    <s-stack gap="tight">
                      <s-heading size="small">Zona horaria y región</s-heading>
                      <s-text subdued>Configura tu zona horaria para reportes precisos</s-text>
                      
                      <s-select
                        label="Zona horaria"
                        options={[
                          { label: 'América/Santo_Domingo (GMT-4)', value: 'America/Santo_Domingo' },
                          { label: 'América/Nueva_York (GMT-5)', value: 'America/New_York' },
                          { label: 'América/Ciudad_de_México (GMT-6)', value: 'America/Mexico_City' }
                        ]}
                        value="America/Santo_Domingo"
                      />
                    </s-stack>
                  </s-stack>
                </s-stack>
              </s-card>
            </s-layout-section>
          </s-layout>
        </s-section>
      )}
      
      {activeTab === 'notifications' && (
        <s-section>
          <s-layout>
            <s-layout-section variant="full">
              <s-card>
                <s-stack gap="base">
                  <s-heading>Notificaciones</s-heading>
                  <s-text subdued>Configura cuándo y cómo recibir alertas</s-text>
                  <s-divider />
                  
                  <s-stack gap="loose">
                    <s-stack gap="tight">
                      <s-checkbox
                        label="Alertas de stock bajo"
                        helpText="Recibe notificaciones cuando un producto tenga stock bajo"
                        checked={notifications.lowStock}
                        onChange={(checked) => handleNotificationChange('lowStock', checked)}
                      />
                    </s-stack>
                    
                    <s-stack gap="tight">
                      <s-checkbox
                        label="Reporte diario"
                        helpText="Recibe un resumen diario de ventas y métricas"
                        checked={notifications.dailyReport}
                        onChange={(checked) => handleNotificationChange('dailyReport', checked)}
                      />
                    </s-stack>
                    
                    <s-stack gap="tight">
                      <s-checkbox
                        label="Reporte semanal"
                        helpText="Recibe un análisis semanal detallado"
                        checked={notifications.weeklyReport}
                        onChange={(checked) => handleNotificationChange('weeklyReport', checked)}
                      />
                    </s-stack>
                    
                    <s-stack gap="tight">
                      <s-checkbox
                        label="Reporte mensual"
                        helpText="Recibe un informe completo mensual"
                        checked={notifications.monthlyReport}
                        onChange={(checked) => handleNotificationChange('monthlyReport', checked)}
                      />
                    </s-stack>
                    
                    <s-divider />
                    
                    <s-stack gap="tight">
                      <s-heading size="small">Destinatarios de email</s-heading>
                      <s-text-field
                        label="Emails"
                        helpText="Separa múltiples emails con comas"
                        value={notifications.emailRecipients?.join(', ') || ''}
                        onChange={(value) => handleNotificationChange('emailRecipients', value.split(',').map(e => e.trim()))}
                      />
                    </s-stack>
                  </s-stack>
                </s-stack>
              </s-card>
            </s-layout-section>
          </s-layout>
        </s-section>
      )}
      
      {activeTab === 'inventory' && (
        <s-section>
          <s-layout>
            <s-layout-section variant="full">
              <s-card>
                <s-stack gap="base">
                  <s-heading>Configuración de Inventario</s-heading>
                  <s-text subdued>Define umbrales y comportamientos del inventario</s-text>
                  <s-divider />
                  
                  <s-layout>
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-text-field
                          label="Umbral de stock bajo"
                          type="number"
                          helpText="Cantidad mínima antes de alertar"
                          value={inventory.lowStockThreshold}
                          onChange={(value) => handleInventoryChange('lowStockThreshold', parseInt(value))}
                          suffix="unidades"
                        />
                        
                        <s-text-field
                          label="Umbral crítico"
                          type="number"
                          helpText="Cantidad crítica que requiere acción inmediata"
                          value={inventory.criticalStockThreshold}
                          onChange={(value) => handleInventoryChange('criticalStockThreshold', parseInt(value))}
                          suffix="unidades"
                        />
                      </s-stack>
                    </s-layout-section>
                    
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-checkbox
                          label="Reorden automático"
                          helpText="Crear órdenes de compra automáticamente"
                          checked={inventory.autoReorder}
                          onChange={(checked) => handleInventoryChange('autoReorder', checked)}
                        />
                        
                        <s-text-field
                          label="Tiempo de entrega"
                          type="number"
                          helpText="Días promedio de entrega de proveedores"
                          value={inventory.leadTimeDays}
                          onChange={(value) => handleInventoryChange('leadTimeDays', parseInt(value))}
                          suffix="días"
                        />
                      </s-stack>
                    </s-layout-section>
                  </s-layout>
                </s-stack>
              </s-card>
            </s-layout-section>
          </s-layout>
        </s-section>
      )}
      
      {activeTab === 'analytics' && (
        <s-section>
          <s-layout>
            <s-layout-section variant="full">
              <s-card>
                <s-stack gap="base">
                  <s-heading>Configuración de Analytics</s-heading>
                  <s-text subdued>Personaliza cómo se muestran los datos analíticos</s-text>
                  <s-divider />
                  
                  <s-layout>
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-select
                          label="Período predeterminado"
                          helpText="Período de tiempo por defecto en los reportes"
                          options={[
                            { label: 'Últimos 7 días', value: '7d' },
                            { label: 'Últimos 30 días', value: '30d' },
                            { label: 'Últimos 90 días', value: '90d' },
                            { label: 'Último año', value: '365d' }
                          ]}
                          value={analytics.defaultPeriod}
                          onChange={(value) => handleAnalyticsChange('defaultPeriod', value)}
                        />
                        
                        <s-checkbox
                          label="Mostrar comparaciones"
                          helpText="Compara automáticamente con el período anterior"
                          checked={analytics.showComparisons}
                          onChange={(checked) => handleAnalyticsChange('showComparisons', checked)}
                        />
                      </s-stack>
                    </s-layout-section>
                    
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-checkbox
                          label="Actualización automática"
                          helpText="Actualiza los dashboards automáticamente"
                          checked={analytics.autoRefresh}
                          onChange={(checked) => handleAnalyticsChange('autoRefresh', checked)}
                        />
                        
                        {analytics.autoRefresh && (
                          <s-select
                            label="Intervalo de actualización"
                            options={[
                              { label: 'Cada 5 minutos', value: 5 },
                              { label: 'Cada 15 minutos', value: 15 },
                              { label: 'Cada 30 minutos', value: 30 },
                              { label: 'Cada hora', value: 60 }
                            ]}
                            value={analytics.refreshInterval}
                            onChange={(value) => handleAnalyticsChange('refreshInterval', parseInt(value))}
                          />
                        )}
                      </s-stack>
                    </s-layout-section>
                  </s-layout>
                </s-stack>
              </s-card>
            </s-layout-section>
          </s-layout>
        </s-section>
      )}
      
      {activeTab === 'display' && (
        <s-section>
          <s-layout>
            <s-layout-section variant="full">
              <s-card>
                <s-stack gap="base">
                  <s-heading>Preferencias de Visualización</s-heading>
                  <s-text subdued>Personaliza la apariencia de la aplicación</s-text>
                  <s-divider />
                  
                  <s-layout>
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-radio-button
                          label="Tema de la aplicación"
                          helpText="Elige entre tema claro u oscuro"
                          options={[
                            { label: 'Claro', value: 'light' },
                            { label: 'Oscuro', value: 'dark' },
                            { label: 'Automático (sistema)', value: 'auto' }
                          ]}
                          value={display.theme}
                          onChange={(value) => handleDisplayChange('theme', value)}
                        />
                        
                        <s-checkbox
                          label="Modo compacto"
                          helpText="Reduce el espaciado para ver más información"
                          checked={display.compactMode}
                          onChange={(checked) => handleDisplayChange('compactMode', checked)}
                        />
                      </s-stack>
                    </s-layout-section>
                    
                    <s-layout-section variant="one-half">
                      <s-stack gap="loose">
                        <s-checkbox
                          label="Mostrar animaciones"
                          helpText="Habilita transiciones y efectos visuales"
                          checked={display.showAnimations}
                          onChange={(checked) => handleDisplayChange('showAnimations', checked)}
                        />
                        
                        <s-radio-button
                          label="Vista predeterminada"
                          helpText="Cómo mostrar listas por defecto"
                          options={[
                            { label: 'Grid', value: 'grid' },
                            { label: 'Lista', value: 'list' }
                          ]}
                          value={display.defaultView}
                          onChange={(value) => handleDisplayChange('defaultView', value)}
                        />
                      </s-stack>
                    </s-layout-section>
                  </s-layout>
                </s-stack>
              </s-card>
            </s-layout-section>
          </s-layout>
        </s-section>
      )}
      
      {/* Footer con información adicional */}
      <s-section>
        <s-card style={{ background: '#f6f6f7', textAlign: 'center' }}>
          <s-stack gap="tight">
            <s-text size="small" subdued>
              Multi-Location Analytics v1.0.0 | Desarrollado para {shop?.name}
            </s-text>
            <s-stack direction="inline" gap="tight" alignment="center">
              <s-link url="https://help.shopify.com" external>
                Centro de ayuda
              </s-link>
              <s-text size="small" subdued>•</s-text>
              <s-link url="https://shopify.dev" external>
                Documentación API
              </s-link>
              <s-text size="small" subdued>•</s-text>
              <s-link onClick={() => navigate('/app/configuracion/logs')}>
                Ver logs
              </s-link>
            </s-stack>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}