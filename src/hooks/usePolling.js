import { useEffect, useRef, useState } from 'react'
export function usePolling(fn, {interval=5000, enabled=true}={}){
const [data, setData] = useState(null)
const [error, setError] = useState(null)
const [loading, setLoading] = useState(false)
const timer = useRef()

async function tick(){
try {
setLoading(true)
const res = await fn()
setData(res)
setError(null)
} catch (e){ setError(e) } finally { setLoading(false) }
}

useEffect(() => {
if(!enabled) return;
tick()
timer.current = setInterval(tick, interval)
return () => clearInterval(timer.current)
}, [enabled, interval])

return { data, error, loading, refetch: tick }
}