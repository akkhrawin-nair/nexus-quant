import { PaperTool } from './ResearchTools'

export default function PaperTradingModal(props) {
  return props.isOpen ? <PaperTool {...props} /> : null
}
