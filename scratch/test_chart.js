import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'

try {
  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
  console.log('Success')
} catch (e) {
  console.error('Error:', e.message)
}
