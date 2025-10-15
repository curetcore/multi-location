export default function StatsOverview({ stats }) {
  const statsCards = [
    {
      title: "Ubicaciones",
      value: stats.totalLocations,
      icon: "🏢",
      color: "info",
      trend: "+0%",
    },
    {
      title: "Total Inventario",
      value: stats.totalInventory.toLocaleString(),
      icon: "📦",
      color: "success",
      trend: "+12%",
    },
    {
      title: "Valor Total",
      value: `$${stats.totalValue.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: "💰",
      color: "warning",
      trend: "+8%",
    },
    {
      title: "Promedio por Ubicación",
      value: stats.totalLocations > 0 
        ? Math.round(stats.totalInventory / stats.totalLocations).toLocaleString()
        : 0,
      icon: "📊",
      color: "default",
      trend: "+5%",
    },
  ];

  return (
    <s-section>
      <s-layout>
        {statsCards.map((stat, index) => (
          <s-layout-section variant="one-quarter" key={index}>
            <s-card>
              <s-stack direction="inline" alignment="center" gap="base">
                <s-text size="large">{stat.icon}</s-text>
                <s-stack gap="tight">
                  <s-text size="small" subdued>
                    {stat.title}
                  </s-text>
                  <s-heading size="medium">{stat.value}</s-heading>
                  <s-badge tone={stat.trend.startsWith('+') ? 'success' : 'warning'}>
                    {stat.trend}
                  </s-badge>
                </s-stack>
              </s-stack>
            </s-card>
          </s-layout-section>
        ))}
      </s-layout>
    </s-section>
  );
}