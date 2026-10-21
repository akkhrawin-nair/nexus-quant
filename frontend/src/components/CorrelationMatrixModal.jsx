import { CorrelationTool } from './ResearchTools'

export default function CorrelationMatrixModal(props) {
  return props.isOpen ? <CorrelationTool {...props} /> : null
}
