// European Black–Scholes with continuous yield. All prices are per unit.
const pdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)
const cdf=x=>{
  const z=Math.abs(x),t=1/(1+.2316419*z)
  const tail=pdf(z)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))))
  return x>=0 ? 1-tail : tail
}
const numeric=(value,min,max,name)=>{
  if(String(value??'').trim()==='' || !Number.isFinite(Number(value)) || Number(value)<min || Number(value)>max)throw new Error(`Enter a valid model ${name} (${min} to ${max}).`)
  return Number(value)
}
export function optionModel(input) {
  const s=numeric(input.spot,.0001,1e6,'underlying price'), k=numeric(input.strike,.0001,1e6,'strike')
  const t=numeric(input.days,0,14,'days to expiry')/365, v=numeric(input.iv,.01,500,'annual IV (%)')/100
  const r=numeric(input.rate,-10,100,'annual rate (%)')/100, q=numeric(input.dividend,0,100,'annual dividend yield (%)')/100
  if(!['call','put'].includes(input.type))throw new Error('Choose a model call or put.')
  const sign=input.type==='call'?1:-1
  if(t===0)return {price:Math.max(sign*(s-k),0),delta:null,gamma:null,vega:null,theta:null}
  const root=Math.sqrt(t),d1=(Math.log(s/k)+(r-q+v*v/2)*t)/(v*root),d2=d1-v*root
  const eq=Math.exp(-q*t),er=Math.exp(-r*t),nd1=cdf(sign*d1),nd2=cdf(sign*d2)
  return {price:Math.max(0,sign*(s*eq*nd1-k*er*nd2)),delta:sign*eq*nd1,
    gamma:eq*pdf(d1)/(s*v*root),vega:s*eq*pdf(d1)*root/100,
    theta:(-s*eq*pdf(d1)*v/(2*root)+sign*q*s*eq*nd1-sign*r*k*er*nd2)/365}
}
export function impliedVolatility(input,price) {
  numeric(price,0,1e6,'premium')
  if(Number(input.days)===0)return null
  let low=.01,high=500
  const lo=optionModel({...input,iv:low}).price,hi=optionModel({...input,iv:high}).price
  if(price<=lo+1e-8 || price>=hi-1e-8)return null
  for(let i=0;i<80;i++){
    const mid=(low+high)/2
    if(optionModel({...input,iv:mid}).price<price)low=mid;else high=mid
  }
  return (low+high)/2
}
export function modelScenarios(input) {
  optionModel(input)
  return [...new Set([0,Math.min(1,Number(input.days)),Math.min(7,Number(input.days)),Number(input.days)])]
    .flatMap(elapsedDays=>[-10,0,10].map(movePct=>({elapsedDays,movePct,
      ...optionModel({...input,spot:Number(input.spot)*(1+movePct/100),days:Number(input.days)-elapsedDays})})))
}
