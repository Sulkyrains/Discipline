import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { quoteForDate } from '../lib/quotes'

export default function Splash() {
  const navigate = useNavigate()
  const quote = quoteForDate()

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 2400)
    return () => window.clearTimeout(timer)
  }, [navigate])

  return (
    <div className="splash">
      <div className="splash-logo">
        <Logo size={92} />
      </div>
      <h1 className="splash-title">Discipline</h1>
      <p className="splash-quote">“{quote.en}”</p>
      <p className="splash-quote-zh">{quote.zh}</p>
      <div className="splash-loader" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
