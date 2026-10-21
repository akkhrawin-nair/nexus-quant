import { EducationTool } from './ResearchTools'

export default function MicroRecoveryHub(props) {
  return props.isOpen ? <EducationTool {...props} /> : null
}
