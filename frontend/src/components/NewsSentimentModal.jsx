import { NewsTool } from './ResearchTools'

export default function NewsSentimentModal(props) {
  return props.isOpen ? <NewsTool {...props} /> : null
}
