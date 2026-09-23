import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Renders a Chart.js chart and rebuilds it whenever `config` changes.
 */
export default function ChartCanvas({ config }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!config || !canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [config]);

  return <canvas ref={canvasRef} />;
}
