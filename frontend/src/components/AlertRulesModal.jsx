import { AlertsTool } from './ResearchTools'
export default function AlertRulesModal(props) {
  return props.isOpen ? <AlertsTool {...props} initialSymbol={props.asset?.symbol || props.initialSymbol} /> : null
}
