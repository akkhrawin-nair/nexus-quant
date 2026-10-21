import { RiskTool } from './ResearchTools'

export default function PortfolioSimulatorModal(props) {
  return props.isOpen ? <RiskTool {...props} /> : null
}
