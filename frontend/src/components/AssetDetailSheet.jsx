import { IndicatorTool } from './ResearchTools'
export default function AssetDetailSheet(props) {
  return props.asset ? <IndicatorTool {...props} initialSymbol={props.asset?.symbol || props.initialSymbol} /> : null
}
