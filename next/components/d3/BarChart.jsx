"use client";
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const BarChart = ({ data }) => {
  const ref = useRef();

  useEffect(() => {
    const svg = d3.select(ref.current)
      .attr('width', 800)
      .attr('height', 500)
      .style('background-color', '#eee');
    
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d, i) => i * 100)
      .attr('y', d => 500 - 10 * d)
      .attr('width', 50)
      .attr('height', d => d * 10)
      .attr('fill', 'navy')
      .on('click', function() {
        d3.select(this).attr('fill', 'red');
      });
  }, [data]);

  return <svg ref={ref}></svg>;
};

export default BarChart;