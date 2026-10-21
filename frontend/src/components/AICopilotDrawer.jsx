import { EducationTool } from './ResearchTools'
export default function AICopilotDrawer(props) {
  return props.isOpen ? <EducationTool {...props} initialSymbol={props.asset?.symbol || props.initialSymbol} /> : null
}
