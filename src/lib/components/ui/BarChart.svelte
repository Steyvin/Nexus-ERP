<script lang="ts">
	import { onMount } from 'svelte'
	import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

	interface Props {
		labels: string[]
		data: number[]
	}

	let { labels, data }: Props = $props()

	let canvas: HTMLCanvasElement
	let chart: Chart | null = null

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: '#2d7a2d',
						hoverBackgroundColor: '#4da74d',
						borderRadius: 6,
						barPercentage: 0.6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					tooltip: {
						backgroundColor: '#111111',
						borderColor: '#222222',
						borderWidth: 1,
						titleColor: '#f0f0f0',
						bodyColor: '#f0f0f0',
						padding: 10,
						cornerRadius: 8,
						callbacks: {
							label(ctx) {
								return `$${(ctx.parsed.y ?? 0).toLocaleString('es-CO')}`
							}
						}
					}
				},
				scales: {
					x: {
						border: { display: false },
						grid: { display: false },
						ticks: {
							color: '#666666',
							font: { size: 11 }
						}
					},
					y: {
						border: { display: false },
						grid: { color: '#1a1a1a' },
						ticks: {
							color: '#444444',
							font: { size: 11 },
							callback(value) {
								if (typeof value === 'number') {
									if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
									if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
								}
								return value
							}
						}
					}
				}
			}
		})

		return () => chart?.destroy()
	})

	// Actualizar datos cuando cambien
	$effect(() => {
		if (chart) {
			chart.data.labels = labels
			chart.data.datasets[0].data = data
			chart.update()
		}
	})
</script>

<div class="h-full w-full">
	<canvas bind:this={canvas}></canvas>
</div>
