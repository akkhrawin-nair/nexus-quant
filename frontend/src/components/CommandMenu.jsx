import { EducationTool } from './ResearchTools'
export default function CommandMenu(props) {
  return props.isOpen ? <EducationTool {...props} initialSymbol={props.asset?.symbol || props.initialSymbol} /> : null
}
