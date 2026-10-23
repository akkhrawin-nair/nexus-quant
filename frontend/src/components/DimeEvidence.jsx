import { dimeEvidence } from '../lib/researchWorkflow'
export default function DimeEvidence({records}) {
  const data=dimeEvidence(records)
  return <section aria-label="Dime validation evidence" className="data-quality-notice"><h3>Dime validation evidence · manual records</h3>
    <p>{data.comparisons} Dime-labelled comparisons; {data.exactIdentifiers} with matching copied identifiers and confirmed terms; {data.closeTiming} with source timestamps within 5 seconds. Counts describe different checks and do not prove one comparison passes all checks.</p>
    <p>{data.paperReports} Dime-labelled broker-paper execution reports; {data.realReports} user-reported real execution reports; {data.debitMismatches} reported debit discrepancies. Independently verified records: 0.</p>
    <p>Copy Dime’s bid, ask, quote time, exact contract, multiplier and preview fees below. Compare buy cost at ask and sell reference at bid. Last price and midpoint are not executable prices. If no prior record exists, leave this evidence empty; no new trade is needed.</p>
  </section>
}
