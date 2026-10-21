import { OptimizerTool } from './ResearchTools'

export default function PortfolioOptimizerModal(props) {
  return props.isOpen ? <OptimizerTool {...props} /> : null
}
