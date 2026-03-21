import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
	configurable: true,
	value: 960
})

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
	configurable: true,
	value: 400
})

HTMLElement.prototype.getBoundingClientRect = function () {
	return {
		width: 960,
		height: 400,
		top: 0,
		left: 0,
		right: 960,
		bottom: 400,
		x: 0,
		y: 0,
		toJSON() {
			return this
		}
	}

	vi.mock('recharts', async () => {
		const createWrapper = (tagName) => {
			return function MockWrapper({ children, ...props }) {
				return React.createElement(tagName, props, children)
			}
		}

		return {
			ResponsiveContainer: createWrapper('div'),
			LineChart: createWrapper('svg'),
			AreaChart: createWrapper('svg'),
			Line: () => null,
			Area: () => null,
			XAxis: () => null,
			YAxis: () => null,
			Tooltip: () => null,
			CartesianGrid: () => null
		}
	})
}