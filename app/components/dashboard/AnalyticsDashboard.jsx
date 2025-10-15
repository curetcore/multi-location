import { useState } from "react";
import StatsOverview from "../analytics/StatsOverview";
import LocationInventoryChart from "../charts/LocationInventoryChart";
import InventoryValueChart from "../charts/InventoryValueChart";
import LocationsTable from "../analytics/LocationsTable";

export default function AnalyticsDashboard({ inventoryData, stats }) {
  const [selectedLocation, setSelectedLocation] = useState(null);

  return (
    <s-page heading="Multi-Location Analytics">
      <s-section>
        <s-heading>Dashboard General</s-heading>
        <s-paragraph>
          Análisis completo de inventario en todas tus ubicaciones
        </s-paragraph>
      </s-section>

      {/* Estadísticas generales */}
      <StatsOverview stats={stats} />

      {/* Gráficas principales */}
      <s-layout>
        <s-layout-section variant="one-half">
          <s-section>
            <s-card>
              <s-heading>Inventario por Ubicación</s-heading>
              <LocationInventoryChart data={inventoryData} />
            </s-card>
          </s-section>
        </s-layout-section>
        
        <s-layout-section variant="one-half">
          <s-section>
            <s-card>
              <s-heading>Valor del Inventario</s-heading>
              <InventoryValueChart data={inventoryData} />
            </s-card>
          </s-section>
        </s-layout-section>
      </s-layout>

      {/* Tabla de ubicaciones */}
      <s-section>
        <s-card>
          <LocationsTable 
            inventoryData={inventoryData} 
            onSelectLocation={setSelectedLocation}
          />
        </s-card>
      </s-section>

      {/* Información adicional */}
      <s-section slot="aside" heading="Métricas Clave">
        <s-paragraph>
          <s-text>Total de ubicaciones: </s-text>
          <s-text emphasis="strong">{stats.totalLocations}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Productos en inventario: </s-text>
          <s-text emphasis="strong">{stats.totalInventory.toLocaleString()}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Valor total: </s-text>
          <s-text emphasis="strong">${stats.totalValue.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Acciones Rápidas">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/locations">Ver todas las ubicaciones</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/inventory">Gestionar inventario</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/reports">Generar reportes</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}