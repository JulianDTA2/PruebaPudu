import clsx from 'clsx'
import { forwardRef, createContext, useContext, useState, useEffect } from 'react'

// Context para compartir estado entre componentes Card
const CardContext = createContext({})

// Hook para usar el contexto
export const useCard = () => {
  const context = useContext(CardContext)
  if (!context) {
    throw new Error('Card components must be used within a Card')
  }
  return context
}

// Componente principal Card con forwardRef para mejor integración
export const Card = forwardRef(({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  hoverable = false,
  onClick,
  loading = false,
  disabled = false,
  selected = false,
  animated = true,
  glow = false,
  gradient = null,
  as: Component = 'div',
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  const variants = {
    default: 'card-neu',
    inset: 'card-inset',
    flat: 'bg-transparent shadow-none',
    glass: 'card-glass',
    gradient: 'card-gradient',
    outlined: 'card-outlined'
  }
 
  const sizes = {
    xs: 'card-neu-xs',
    sm: 'card-neu-sm',
    md: 'card-neu',
    lg: 'card-neu-lg',
    xl: 'card-neu-xl'
  }

  const gradientStyles = {
    blue: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    purple: 'bg-gradient-to-br from-purple-500 to-pink-600',
    green: 'bg-gradient-to-br from-green-500 to-emerald-600',
    orange: 'bg-gradient-to-br from-orange-500 to-red-600',
    dark: 'bg-gradient-to-br from-gray-800 to-gray-900'
  }
 
  const classes = clsx(
    variant === 'default' ? sizes[size] : variants[variant],
    {
      'hover-lift cursor-pointer': hoverable || onClick,
      'fade-in': animated,
      'opacity-50 pointer-events-none': disabled,
      'card-loading': loading,
      'card-selected': selected,
      'card-glow': glow,
      [gradientStyles[gradient]]: gradient && variant === 'gradient'
    },
    className
  )

  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e)
    }
  }

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      handleClick(e)
    }
  }

  const contextValue = {
    variant,
    size,
    isHovered,
    isPressed,
    loading,
    disabled
  }
 
  return (
    <CardContext.Provider value={contextValue}>
      <Component
        ref={ref}
        className={classes}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        aria-disabled={disabled}
        aria-busy={loading}
        aria-selected={selected}
        data-variant={variant}
        data-size={size}
        {...props}
      >
        {loading && (
          <div className="card-loader">
            <div className="card-loader-spinner" />
          </div>
        )}
        {children}
      </Component>
    </CardContext.Provider>
  )
})

Card.displayName = 'Card'

// CardHeader mejorado con más opciones
export function CardHeader({ 
  className = '', 
  children,
  title,
  subtitle,
  action,
  icon,
  separator = true 
}) {
  const { variant, size } = useContext(CardContext) || {}
  
  const headerClasses = clsx(
    'card-header',
    {
      'mb-4 pb-4': separator,
      'border-b border-gray-200/20': separator,
      'card-header-sm': size === 'sm',
      'card-header-lg': size === 'lg'
    },
    className
  )

  return (
    <div className={headerClasses}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="card-header-icon">
              {icon}
            </div>
          )}
          <div className="flex-1">
            {title && (
              <h3 className="card-header-title">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="card-header-subtitle">
                {subtitle}
              </p>
            )}
            {children}
          </div>
        </div>
        {action && (
          <div className="card-header-action">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

// CardContent mejorado
export function CardContent({ 
  className = '', 
  children,
  padded = true,
  centered = false 
}) {
  const { loading } = useContext(CardContext) || {}
  
  const contentClasses = clsx(
    'card-content',
    {
      'space-y-4': padded,
      'flex items-center justify-center': centered,
      'opacity-50': loading
    },
    className
  )

  return (
    <div className={contentClasses}>
      {children}
    </div>
  )
}

// CardFooter mejorado
export function CardFooter({ 
  className = '', 
  children,
  separator = true,
  actions,
  align = 'right' 
}) {
  const footerClasses = clsx(
    'card-footer',
    {
      'mt-4 pt-4': separator,
      'border-t border-gray-200/20': separator,
      'flex items-center': actions,
      'justify-end': align === 'right' && actions,
      'justify-start': align === 'left' && actions,
      'justify-center': align === 'center' && actions,
      'justify-between': align === 'between' && actions,
      'gap-2': actions
    },
    className
  )

  return (
    <div className={footerClasses}>
      {children || actions}
    </div>
  )
}

// ResponseCard mejorado con syntax highlighting y copy
export function ResponseCard({ 
  data, 
  className = '', 
  maxHeight = '400px',
  language = 'json',
  showCopy = true,
  showLineNumbers = false,
  theme = 'dark' 
}) {
  const [copied, setCopied] = useState(false)
  
  const formattedData = typeof data === 'string' 
    ? data 
    : JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedData)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const lines = formattedData.split('\n')

  return (
    <div
      className={clsx('card-response', `card-response-${theme}`, className)}
      style={{ maxHeight }}
    >
      {showCopy && (
        <button
          className="card-response-copy"
          onClick={handleCopy}
          aria-label="Copy to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
      <pre className="whitespace-pre-wrap break-words">
        {showLineNumbers ? (
          <div className="flex">
            <div className="card-response-lines">
              {lines.map((_, i) => (
                <div key={i} className="card-response-line-number">
                  {i + 1}
                </div>
              ))}
            </div>
            <code className="flex-1 pl-4">
              {formattedData}
            </code>
          </div>
        ) : (
          <code>{formattedData}</code>
        )}
      </pre>
    </div>
  )
}

// StatCard mejorado con animaciones y más opciones
export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  loading = false,
  animated = true,
  variant = 'default',
  color = 'blue',
  className = '',
  onClick,
  footer
}) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Animación de contador si es número
  useEffect(() => {
    if (animated && typeof value === 'number' && isVisible) {
      const duration = 1000
      const steps = 60
      const increment = value / steps
      let current = 0
      
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, duration / steps)

      return () => clearInterval(timer)
    } else {
      setDisplayValue(value)
    }
  }, [value, animated, isVisible])

  // Observer para animación on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )

    const element = document.querySelector(`[data-stat="${label}"]`)
    if (element) observer.observe(element)

    return () => {
      if (element) observer.unobserve(element)
    }
  }, [label])

  const statVariants = {
    default: 'stat-card',
    compact: 'stat-card-compact',
    outlined: 'stat-card-outlined',
    filled: 'stat-card-filled'
  }

  const colorClasses = {
    blue: 'stat-color-blue',
    green: 'stat-color-green',
    purple: 'stat-color-purple',
    orange: 'stat-color-orange',
    red: 'stat-color-red'
  }

  const cardClasses = clsx(
    statVariants[variant],
    colorClasses[color],
    {
      'stat-card-clickable': onClick,
      'stat-card-loading': loading
    },
    className
  )

  const formatValue = () => {
    if (loading) return '...'
    if (animated && typeof value === 'number') {
      return displayValue.toLocaleString()
    }
    return value
  }

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-stat={label}
    >
      {loading && <div className="stat-card-loader" />}
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="stat-label">{label}</div>
          <div className="stat-value">{formatValue()}</div>
          {hint && <div className="stat-hint">{hint}</div>}
        </div>
        {icon && (
          <div className="stat-icon">
            {icon}
          </div>
        )}
      </div>
      
      {trend !== undefined && (
        <div className={clsx('stat-trend', {
          'stat-trend-up': trend > 0,
          'stat-trend-down': trend < 0,
          'stat-trend-neutral': trend === 0
        })}>
          <span className="stat-trend-arrow">
            {trend > 0 && '↑'} 
            {trend < 0 && '↓'} 
            {trend === 0 && '→'}
          </span>
          <span className="stat-trend-value">
            {Math.abs(trend)}%
          </span>
          {trendLabel && (
            <span className="stat-trend-label">
              {trendLabel}
            </span>
          )}
        </div>
      )}
      
      {footer && (
        <div className="stat-footer">
          {footer}
        </div>
      )}
    </div>
  )
}

// Nuevo componente: CardGrid para layouts
export function CardGrid({ 
  children, 
  columns = 3, 
  gap = 'md',
  responsive = true,
  className = '' 
}) {
  const gapSizes = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  const gridClasses = clsx(
    'grid',
    gapSizes[gap],
    {
      'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4': responsive && columns === 4,
      'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3': responsive && columns === 3,
      'grid-cols-1 sm:grid-cols-2': responsive && columns === 2,
      [`grid-cols-${columns}`]: !responsive
    },
    className
  )

  return (
    <div className={gridClasses}>
      {children}
    </div>
  )
}

// Nuevo componente: CardStack para cards apiladas
export function CardStack({ 
  children, 
  spacing = 'md',
  className = '' 
}) {
  const spacingSizes = {
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  }

  return (
    <div className={clsx(spacingSizes[spacing], className)}>
      {children}
    </div>
  )
}