import React from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartJSLineProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
}

interface ChartJSBarProps {
  data: ChartData<'bar'>;
  options?: ChartOptions<'bar'>;
}

interface ChartJSPieProps {
  data: ChartData<'pie'>;
  options?: ChartOptions<'pie'>;
}

export function ChartJSLine({ data, options }: ChartJSLineProps) {
  // Add comprehensive checks to ensure data is properly formatted
  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }
  
  // Check if labels exist and are in the correct format
  if (!data.labels || !Array.isArray(data.labels)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Invalid chart labels format
      </div>
    );
  }
  
  // Check if datasets exist and are in the correct format
  if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No datasets available for chart
      </div>
    );
  }
  
  // Check if each dataset has data
  for (const dataset of data.datasets) {
    if (!dataset.data || !Array.isArray(dataset.data)) {
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          Invalid dataset format
        </div>
      );
    }
  }
  
  // If all checks pass, render the chart
  try {
    return (
      <div className="w-full h-full">
        <Line data={data} options={options} />
      </div>
    );
  } catch (error) {
    console.error("Error rendering chart:", error);
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Error rendering chart
      </div>
    );
  }
}

export function ChartJSBar({ data, options }: ChartJSBarProps) {
  // Add comprehensive checks to ensure data is properly formatted
  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }
  
  // Check if labels exist and are in the correct format
  if (!data.labels || !Array.isArray(data.labels)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Invalid chart labels format
      </div>
    );
  }
  
  // Check if datasets exist and are in the correct format
  if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No datasets available for chart
      </div>
    );
  }
  
  // Check if each dataset has data
  for (const dataset of data.datasets) {
    if (!dataset.data || !Array.isArray(dataset.data)) {
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          Invalid dataset format
        </div>
      );
    }
  }
  
  // If all checks pass, render the chart
  try {
    return (
      <div className="w-full h-full">
        <Bar data={data} options={options} />
      </div>
    );
  } catch (error) {
    console.error("Error rendering chart:", error);
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Error rendering chart
      </div>
    );
  }
}

// Export aliases for simpler imports
export const LineChart = ChartJSLine;
export const BarChart = ChartJSBar;
export const PieChart = ChartJSPie;

export function ChartJSPie({ data, options }: ChartJSPieProps) {
  // Add comprehensive checks to ensure data is properly formatted
  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }
  
  // Check if labels exist and are in the correct format
  if (!data.labels || !Array.isArray(data.labels)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Invalid chart labels format
      </div>
    );
  }
  
  // Check if datasets exist and are in the correct format
  if (!data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No datasets available for chart
      </div>
    );
  }
  
  // Check if each dataset has data
  for (const dataset of data.datasets) {
    if (!dataset.data || !Array.isArray(dataset.data)) {
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          Invalid dataset format
        </div>
      );
    }
  }
  
  // If all checks pass, render the chart
  try {
    return (
      <div className="w-full h-full">
        <Pie data={data} options={options} />
      </div>
    );
  } catch (error) {
    console.error("Error rendering chart:", error);
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Error rendering chart
      </div>
    );
  }
}