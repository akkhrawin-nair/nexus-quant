import { ChartTool } from './ResearchTools'
export default function FullChartModal(props) {
  return props.isOpen ? <ChartTool {...props} initialSymbol={props.asset?.symbol || props.initialSymbol} /> : null
}
