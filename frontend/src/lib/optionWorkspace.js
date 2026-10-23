import { parseOptionContract } from './optionContract.js'
import { marketDate } from './options.js'

export const OPTION_PANELS=['plan','compare','journal']
export function optionPanelForKey(key,current) {
  const index=OPTION_PANELS.indexOf(current)
  if(index<0)return null
  if(key==='Home')return OPTION_PANELS[0]
  if(key==='End')return OPTION_PANELS.at(-1)
  if(key==='ArrowRight')return OPTION_PANELS[(index+1)%OPTION_PANELS.length]
  if(key==='ArrowLeft')return OPTION_PANELS[(index+OPTION_PANELS.length-1)%OPTION_PANELS.length]
  return null
}

export function fillOptionContract(form,value,now=Date.now()) {
  const contract=parseOptionContract(value), today=Date.parse(`${marketDate(now)}T00:00:00Z`), expiration=Date.parse(`${contract.expiration}T00:00:00Z`)
  if(expiration<today || expiration>today+14*86400000)throw new Error('Choose a contract expiring within 14 calendar days of today (New York date).')
  return {contractSymbol:contract.contractSymbol,form:{...form,symbol:contract.symbol,type:contract.type,strike:String(contract.strike),expiration:contract.expiration,
    bid:'',ask:'',quoteTime:'',bidSize:'',askSize:''}}
}
