import { useNavigate } from "react-router";

export default function LocationsTable({ inventoryData, onSelectLocation }) {
  const navigate = useNavigate();

  const handleViewDetails = (locationId) => {
    navigate(`/app/location/${locationId}`);
    onSelectLocation?.(locationId);
  };

  const tableRows = inventoryData.map(({ location, inventory }) => {
    const totalItems = inventory.reduce((sum, item) => {
      const available = item.node.quantities?.find(q => q.name === "available")?.quantity || 0;
      return sum + available;
    }, 0);

    const totalValue = inventory.reduce((sum, item) => {
      const available = item.node.quantities?.find(q => q.name === "available")?.quantity || 0;
      const price = parseFloat(item.node.item?.variant?.price || 0);
      return sum + (available * price);
    }, 0);

    const uniqueProducts = new Set(inventory.map(item => item.node.item?.variant?.product?.id)).size;

    return {
      id: location.id,
      name: location.name,
      address: location.address?.city || 'Sin dirección',
      products: uniqueProducts,
      items: totalItems,
      value: totalValue,
      status: location.isActive,
    };
  });

  return (
    <s-section>
      <s-stack direction="inline" alignment="space-between">
        <s-heading>Detalles por Ubicación</s-heading>
        <s-button onClick={() => window.location.reload()}>
          Actualizar datos
        </s-button>
      </s-stack>
      
      <s-table style={{ marginTop: '1rem' }}>
        <s-table-head>
          <s-table-row>
            <s-table-header>Ubicación</s-table-header>
            <s-table-header>Ciudad</s-table-header>
            <s-table-header>Productos</s-table-header>
            <s-table-header>Items</s-table-header>
            <s-table-header>Valor</s-table-header>
            <s-table-header>Estado</s-table-header>
            <s-table-header>Acciones</s-table-header>
          </s-table-row>
        </s-table-head>
        <s-table-body>
          {tableRows.map((row) => (
            <s-table-row key={row.id}>
              <s-table-cell>{row.name}</s-table-cell>
              <s-table-cell>{row.address}</s-table-cell>
              <s-table-cell>{row.products}</s-table-cell>
              <s-table-cell>{row.items.toLocaleString()}</s-table-cell>
              <s-table-cell>
                ${row.value.toLocaleString('es-DO', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </s-table-cell>
              <s-table-cell>
                <s-badge tone={row.status ? 'success' : 'warning'}>
                  {row.status ? 'Activa' : 'Inactiva'}
                </s-badge>
              </s-table-cell>
              <s-table-cell>
                <s-button 
                  variant="tertiary"
                  size="small"
                  onClick={() => handleViewDetails(row.id)}
                >
                  Ver detalles
                </s-button>
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-section>
  );
}