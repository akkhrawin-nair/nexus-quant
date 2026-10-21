import { EducationTool } from './ResearchTools'

export default function AIMentorModal(props) {
  return props.isOpen ? <EducationTool {...props} /> : null
}
