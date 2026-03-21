"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as echarts from "echarts";

const alphaSeries = [
    { name: "Strategy 1", alpha: 1.82 },
    { name: "Strategy 2", alpha: -1.37 },
    { name: "Strategy 3", alpha: 1.14 },
    { name: "Strategy 4", alpha: 1.54 },
    { name: "Strategy 5", alpha: -0.71 },
    { name: "Strategy 6", alpha: 0.68 },
];

export function AlphaBarChart() {
    const chartRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (!chartRef.current) {
            return undefined;
        }

        const chart = echarts.init(chartRef.current);
        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });

        resizeObserver.observe(chartRef.current);

        chart.setOption({
            animationDuration: 900,
            animationEasing: "quarticOut",
            grid: {
                top: 40,
                right: 24,
                bottom: 72,
                left: 24,
                containLabel: true,
            },
            tooltip: {
                trigger: "item",
                backgroundColor: "rgba(8, 15, 30, 0.94)",
                borderColor: "rgba(125, 211, 252, 0.24)",
                borderWidth: 1,
                textStyle: {
                    color: "#e2f3ff",
                    fontSize: 12,
                },
                formatter: ({ name, value }) => `${name}<br/>Alpha: ${value.toFixed(2)}`,
            },
            xAxis: {
                type: "category",
                data: alphaSeries.map((item) => item.name),
                axisLine: {
                    lineStyle: {
                        color: "rgba(148, 163, 184, 0.18)",
                    },
                },
                axisTick: {
                    show: false,
                },
                axisLabel: {
                    interval: 0,
                    color: "rgba(226, 232, 240, 0.72)",
                    fontSize: 11,
                    rotate: 18,
                    margin: 18,
                },
            },
            yAxis: {
                type: "value",
                name: "Alpha",
                nameTextStyle: {
                    color: "rgba(191, 219, 254, 0.62)",
                    fontSize: 11,
                    padding: [0, 0, 8, 0],
                },
                splitNumber: 4,
                axisLabel: {
                    color: "rgba(226, 232, 240, 0.54)",
                    fontSize: 11,
                },
                axisLine: {
                    show: false,
                },
                axisTick: {
                    show: false,
                },
                splitLine: {
                    lineStyle: {
                        color: "rgba(148, 163, 184, 0.12)",
                        type: "dashed",
                    },
                },
            },
            series: [
                {
                    type: "bar",
                    data: alphaSeries.map((item) => item.alpha),
                    barWidth: "48%",
                    itemStyle: {
                        borderRadius: [18, 18, 10, 10],
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: "#7dd3fc" },
                            { offset: 0.45, color: "#4f8cff" },
                            { offset: 1, color: "#193cb8" },
                        ]),
                        shadowBlur: 28,
                        shadowColor: "rgba(56, 189, 248, 0.24)",
                    },
                    emphasis: {
                        scale: true,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: "#b6ecff" },
                                { offset: 0.4, color: "#67b6ff" },
                                { offset: 1, color: "#2956e8" },
                            ]),
                            shadowBlur: 34,
                            shadowColor: "rgba(125, 211, 252, 0.36)",
                        },
                    },
                },
            ],
        });

        const handleClick = () => {
            router.push("/strategy");
        };

        chart.on("click", handleClick);

        return () => {
            resizeObserver.disconnect();
            chart.off("click", handleClick);
            chart.dispose();
        };
    }, [router]);

    return (
        <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.14),transparent_28%),linear-gradient(180deg,rgba(4,10,24,0.28),rgba(2,6,23,0.44))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/55">
                        Strategy Alpha
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                        Hardcoded alpha leaderboard
                    </h3>
                </div>

                <span className="rounded-full border border-cyan-200/12 bg-cyan-200/8 px-3 py-1 text-xs text-cyan-50/75">
                    Click a bar to open strategy
                </span>
            </div>

            <div ref={chartRef} className="h-[380px] w-full" aria-label="Alpha values bar chart" />
        </div>
    );
}
