import { EducationTool } from './ResearchTools'

export default function TradingAcademyModal(props) {
  return props.isOpen ? <EducationTool {...props} /> : null
}
