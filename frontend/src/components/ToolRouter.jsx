import { BacktestTool, OptimizerTool, CorrelationTool, RiskTool, IndicatorTool, NewsTool, EducationTool, PaperTool, ChartTool, AlertsTool } from './ResearchTools'
import OptionsQuoteTool from './OptionsQuoteTool'
import AnalystDesk from './AnalystDesk'

const tools = {analyst:AnalystDesk,options:OptionsQuoteTool,backtest:BacktestTool,optimizer:OptimizerTool,correlation:CorrelationTool,risk:RiskTool,indicator:IndicatorTool,news:NewsTool,education:EducationTool,paper:PaperTool,chart:ChartTool,alerts:AlertsTool}

export default function ToolRouter({ tool, onClose, ...props }) {
  const Component = tools[tool.kind] || EducationTool
  return <Component key={`${tool.kind}:${tool.symbol || ''}`} onClose={onClose} initialSymbol={tool.symbol} initialTicker={tool.symbol} {...props}/>
}
