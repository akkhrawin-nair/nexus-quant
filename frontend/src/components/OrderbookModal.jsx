import { EducationTool } from './ResearchTools'

export default function OrderbookModal(props) {
  return props.isOpen ? <EducationTool {...props} /> : null
}
