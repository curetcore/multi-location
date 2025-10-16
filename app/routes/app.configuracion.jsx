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
  const [savedMessage, setSavedMessage] = useState(false);
  
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
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };
  
  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '32px 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ 
                color: '#111827', 
                fontSize: '24px', 
                fontWeight: '600',
                margin: '0 0 8px 0',
                letterSpacing: '-0.3px'
              }}>
                Configuración
              </h1>
              <p style={{ 
                color: '#6b7280', 
                fontSize: '16px',
                margin: 0
              }}>
                Personaliza el comportamiento y apariencia de la aplicación
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {savedMessage && (
                <div style={{
                  padding: '8px 16px',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  ✓ Configuración guardada
                </div>
              )}
              <button 
                style={{
                  background: hasChanges ? 'white' : '#f3f4f6',
                  color: hasChanges ? '#111827' : '#9ca3af',
                  border: hasChanges ? '1px solid #d1d5db' : '1px solid #e5e7eb',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
                }}
                disabled={!hasChanges}
                onClick={() => window.location.reload()}
                onMouseEnter={(e) => hasChanges && (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => hasChanges && (e.currentTarget.style.background = 'white')}
              >
                Descartar cambios
              </button>
              <button 
                style={{
                  background: hasChanges ? '#111827' : '#e5e7eb',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
                }}
                disabled={!hasChanges}
                onClick={saveConfiguration}
                onMouseEnter={(e) => hasChanges && (e.currentTarget.style.background = '#1e293b')}
                onMouseLeave={(e) => hasChanges && (e.currentTarget.style.background = '#111827')}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px' }}>
        {/* Información de la tienda */}
        {shop && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>Tienda</p>
                <p style={{ color: '#111827', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>{shop.name}</p>
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>{shop.email}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>Configuración regional</p>
                <p style={{ color: '#111827', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>{shop.currencyCode}</p>
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>{shop.timezoneAbbreviation} ({shop.billingAddress?.city}, {shop.billingAddress?.country})</p>
              </div>
            </div>
          </div>
        )}
      
        {/* Tabs de navegación */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '24px',
          display: 'inline-flex',
          border: '1px solid #e5e7eb'
        }}>
          {[
            { id: 'general', label: 'General' },
            { id: 'notifications', label: 'Notificaciones' },
            { id: 'inventory', label: 'Inventario' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'display', label: 'Visualización' }
          ].map(tab => (
            <button
              key={tab.id}
              style={{
                background: activeTab === tab.id ? '#111827' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginRight: '4px'
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      
        {/* Contenido según tab activa */}
        {activeTab === 'general' && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#111827'
            }}>
              Configuración General
            </h2>
            <div style={{ 
              height: '1px', 
              background: '#e5e7eb', 
              margin: '20px 0' 
            }} />
            
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                margin: '0 0 8px 0',
                color: '#111827'
              }}>
                Información de la aplicación
              </h3>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px 0' }}>
                Detalles básicos sobre la aplicación
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>Versión</p>
                  <p style={{ color: '#111827', fontSize: '16px', fontWeight: '600', margin: 0 }}>1.1.0</p>
                </div>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>Última actualización</p>
                  <p style={{ color: '#111827', fontSize: '16px', fontWeight: '600', margin: 0 }}>{new Date().toLocaleDateString('es-DO')}</p>
                </div>
              </div>
            </div>
            
            <div style={{ 
              height: '1px', 
              background: '#e5e7eb', 
              margin: '32px 0' 
            }} />
            
            <div>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                margin: '0 0 8px 0',
                color: '#111827'
              }}>
                Zona horaria y región
              </h3>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px 0' }}>
                Configura tu zona horaria para reportes precisos
              </p>
              
              <div style={{ maxWidth: '400px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374151' 
                }}>
                  Zona horaria
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#111827',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                  value="America/Santo_Domingo"
                >
                  <option value="America/Santo_Domingo">América/Santo_Domingo (GMT-4)</option>
                  <option value="America/New_York">América/Nueva_York (GMT-5)</option>
                  <option value="America/Mexico_City">América/Ciudad_de_México (GMT-6)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      
      {activeTab === 'notifications' && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            margin: '0 0 8px 0',
            color: '#111827'
          }}>
            Notificaciones
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px 0' }}>
            Configura cuándo y cómo recibir alertas
          </p>
          <div style={{ 
            height: '1px', 
            background: '#e5e7eb', 
            margin: '20px 0' 
          }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { key: 'lowStock', label: 'Alertas de stock bajo', help: 'Recibe notificaciones cuando un producto tenga stock bajo' },
              { key: 'dailyReport', label: 'Reporte diario', help: 'Recibe un resumen diario de ventas y métricas' },
              { key: 'weeklyReport', label: 'Reporte semanal', help: 'Recibe un análisis semanal detallado' },
              { key: 'monthlyReport', label: 'Reporte mensual', help: 'Recibe un informe completo mensual' }
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifications[item.key] || false}
                  onChange={(e) => handleNotificationChange(item.key, e.target.checked)}
                  style={{
                    marginRight: '12px',
                    marginTop: '4px',
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                    {item.help}
                  </p>
                </div>
              </label>
            ))}
            
            <div style={{ 
              height: '1px', 
              background: '#e5e7eb', 
              margin: '20px 0' 
            }} />
            
            <div>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                margin: '0 0 16px 0',
                color: '#111827'
              }}>
                Destinatarios de email
              </h3>
              <div style={{ maxWidth: '400px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: '#374151' 
                }}>
                  Emails
                </label>
                <input
                  type="text"
                  value={notifications.emailRecipients?.join(', ') || ''}
                  onChange={(e) => handleNotificationChange('emailRecipients', e.target.value.split(',').map(email => email.trim()))}
                  placeholder="email1@ejemplo.com, email2@ejemplo.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#111827'
                  }}
                />
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Separa múltiples emails con comas
                </p>
              </div>
            </div>
          </div>
        </div>
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
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginTop: '32px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px 0' }}>
            Multi-Location Analytics v1.1.0 | Desarrollado para {shop?.name}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            <a href="https://help.shopify.com" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', fontSize: '13px', textDecoration: 'none' }}>
              Centro de ayuda
            </a>
            <span style={{ color: '#d1d5db' }}>•</span>
            <a href="https://shopify.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', fontSize: '13px', textDecoration: 'none' }}>
              Documentación API
            </a>
            <span style={{ color: '#d1d5db' }}>•</span>
            <button onClick={() => navigate('/app/configuracion/logs')} style={{ color: '#6b7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Ver logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}