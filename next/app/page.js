import BarChart from '../components/BarChart';
import DynamicChart from '../components/DynamicChart';
import * as d3 from 'd3';

export default function Home() {
  const data = [12, 36, 6, 25, 30, 10, 12]; // 例えば、このデータをビジュアライズします。
  return (
    <div>
      <BarChart data={data} />
      <DynamicChart m={200} n={10} k={10}/>
    </div>
  );
}
