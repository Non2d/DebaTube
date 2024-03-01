"use client";
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// bumps関数の定義
const bump = (a, n) => {
    const x = 1 / (0.1 + Math.random());
    const y = 2 * Math.random() - 0.5;
    const z = 10 / (0.1 + Math.random());
    for (let i = 0; i < n; ++i) {
        const w = (i / n - y) * z;
        a[i] += x * Math.exp(-w * w);
    }
};

const bumps = (n, m) => {
    const a = [];
    for (let i = 0; i < n; ++i) a[i] = 0;
    for (let i = 0; i < m; ++i) bump(a, n);
    return a;
};

const DynamicD3Chart = ({ m, n, k }) => {
    const ref = useRef();

    useEffect(() => {
        const width = 928;
        const height = 500;
        const x = d3.scaleLinear([0, m - 1], [0, width]);
        const y = d3.scaleLinear([0, 1], [height, 0]);
        const z = d3.interpolateCool;

        const area = d3.area()
            .x((d, i) => x(i))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]));

        const stack = d3.stack()
            .keys(d3.range(n))
            .offset(d3.stackOffsetNone)
            .order(d3.stackOrderNone);

        const svg = d3.select(ref.current)
            .attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "max-width: 100%; height: auto;");

        const randomize = () => {
            const layers = stack(d3.transpose(Array.from({ length: n }, () => bumps(m, k))));
            y.domain([
                d3.min(layers, l => d3.min(l, d => d[0])),
                d3.max(layers, l => d3.max(l, d => d[1]))
            ]);
            return layers;
        };

        const updateChart = () => {
            svg.selectAll("path")
                .data(randomize)
                .join("path")
                .attr("d", area)
                .attr("fill", () => z(Math.random()))
                .transition()
                .delay(1000)
                .duration(1500)
                .attr("d", area);
        };

        updateChart();

        // 定期的にチャートを更新する
        const interval = setInterval(updateChart, 2500);

        return () => clearInterval(interval); // コンポーネントのアンマウント時にインターバルをクリア
    }, [m, n, k]); // 依存配列にpropsを追加

    return <svg ref={ref}></svg>;
};

export default DynamicD3Chart;
