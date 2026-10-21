import { BacktestTool } from './ResearchTools'

export default function BacktestModal(props) {
  return props.isOpen ? <BacktestTool {...props} /> : null
}
