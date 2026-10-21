import { IndicatorTool } from './ResearchTools'

export default function AIBrainFusionModal(props) {
  return props.isOpen ? <IndicatorTool {...props} /> : null
}
