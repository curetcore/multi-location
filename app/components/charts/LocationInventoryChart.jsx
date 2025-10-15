import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LocationInventoryChart({ data }) {
  const chartData = data.map(({ location, inventory }) => {
    const totalItems = inventory.reduce((sum, item) => {
      const available = item.node.quantities?.find(q => q.name === "available")?.quantity || 0;
      return sum + available;
    }, 0);

    return {
      name: location.name,
      inventario: totalItems,
    };
  });

  return (
    <div style={{ width: '100%', height: 300, marginTop: 20 }}>
      <ResponsiveContainer>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="inventario" fill="#008060" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}