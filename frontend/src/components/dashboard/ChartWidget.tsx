import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/cn';

interface DataKeyConfig {
  key: string;
  color: string;
  name?: string;
}

interface ChartWidgetProps {
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut';
  data: Record<string, unknown>[];
  dataKeys: DataKeyConfig[];
  xAxisKey?: string;
  title?: string;
  height?: number;
  className?: string;
}

const darkTooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text-primary)',
};

function renderCartesianChart(
  type: 'bar' | 'line' | 'area',
  data: Record<string, unknown>[],
  dataKeys: DataKeyConfig[],
  xAxisKey: string
) {
  const commonAxisProps = {
    stroke: 'var(--color-text-secondary)',
    fontSize: 12,
    tickLine: false,
  };

  const gridProps = {
    strokeDasharray: '3 3',
    stroke: 'var(--color-border)',
  };

  const chartChildren = (
    <>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey={xAxisKey} {...commonAxisProps} />
      <YAxis {...commonAxisProps} />
      <Tooltip contentStyle={darkTooltipStyle} />
      <Legend />
    </>
  );

  if (type === 'bar') {
    return (
      <BarChart data={data}>
        {chartChildren}
        {dataKeys.map((dk) => (
          <Bar
            key={dk.key}
            dataKey={dk.key}
            name={dk.name ?? dk.key}
            fill={dk.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    );
  }

  if (type === 'line') {
    return (
      <LineChart data={data}>
        {chartChildren}
        {dataKeys.map((dk) => (
          <Line
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.name ?? dk.key}
            stroke={dk.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <AreaChart data={data}>
      {chartChildren}
      {dataKeys.map((dk) => (
        <Area
          key={dk.key}
          type="monotone"
          dataKey={dk.key}
          name={dk.name ?? dk.key}
          stroke={dk.color}
          fill={dk.color}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      ))}
    </AreaChart>
  );
}

function renderPieChart(
  data: Record<string, unknown>[],
  dataKeys: DataKeyConfig[],
  isDonut: boolean
) {
  const dk = dataKeys[0];
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey={dk.key}
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={isDonut ? '55%' : 0}
        outerRadius="80%"
        paddingAngle={2}
        strokeWidth={0}
      >
        {data.map((_, idx) => (
          <Cell
            key={idx}
            fill={dataKeys[idx % dataKeys.length]?.color ?? dk.color}
          />
        ))}
      </Pie>
      <Tooltip contentStyle={darkTooltipStyle} />
      <Legend />
    </PieChart>
  );
}

export default function ChartWidget({
  type,
  data,
  dataKeys,
  xAxisKey = 'name',
  title,
  height = 300,
  className,
}: ChartWidgetProps) {
  const isPie = type === 'pie' || type === 'donut';

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4',
        className
      )}
    >
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {isPie
          ? renderPieChart(data, dataKeys, type === 'donut')
          : renderCartesianChart(type, data, dataKeys, xAxisKey)}
      </ResponsiveContainer>
    </div>
  );
}
