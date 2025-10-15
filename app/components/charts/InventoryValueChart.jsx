import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#008060', '#5630ff', '#e3b505', '#ee5737', '#00a0ac'];

export default function InventoryValueChart({ data }) {
  const chartData = data.map(({ location, inventory }) => {
    const totalValue = inventory.reduce((sum, item) => {
      const available = item.node.quantities?.find(q => q.name === "available")?.quantity || 0;
      const price = parseFloat(item.node.item?.variant?.price || 0);
      return sum + (available * price);
    }, 0);

    return {
      name: location.name,
      value: Math.round(totalValue),
    };
  }).filter(item => item.value > 0);

  const formatValue = (value) => {
    return `$${value.toLocaleString('es-DO')}`;
  };

  return (
    <div style={{ width: '100%', height: 300, marginTop: 20 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatValue(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}