import clsx from 'clsx'
import { forwardRef } from 'react'

const Button = forwardRef(({
  as: Comp = 'button',
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  ...props
}, ref) => {
  
  // Variantes de estilo
  const variants = {
    default: 'btn-neu',
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-neu text-red-600',
    success: 'btn-neu text-green-600'
  }
  
  // Tamaños
  const sizes = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  }
  
  // Clases base
  const baseClasses = clsx(
    variants[variant],
    sizes[size],
    'hover-lift active-press focus-visible',
    {
      'opacity-50 cursor-not-allowed': disabled || loading,
      'cursor-wait': loading
    },
    className
  )
  
  // Contenido del botón
  const content = (
    <>
      {loading && <span className="spinner" />}
      {!loading && icon && iconPosition === 'left' && <span>{icon}</span>}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && <span>{icon}</span>}
    </>
  )
  
  return (
    <Comp
      ref={ref}
      className={baseClasses}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {content}
    </Comp>
  )
})

Button.displayName = 'Button'

export default Button