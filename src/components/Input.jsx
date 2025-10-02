import clsx from 'clsx'
import { forwardRef, useState } from 'react'

export const Input = forwardRef(({ 
  label,
  error,
  hint,
  icon,
  type = 'text',
  className = '',
  containerClassName = '',
  ...props 
}, ref) => {
  const [focused, setFocused] = useState(false)
  
  const inputClasses = clsx(
    'input',
    {
      'pl-10': icon,
      'border-red-500': error,
    },
    className
  )
  
  return (
    <div className={clsx('space-y-1', containerClassName) + " input-neu"}>
      {label && (
        <label className="block text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={inputClasses}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          aria-describedby={error ? 'error-message' : hint ? 'hint-message' : undefined}
          {...props}
        />
      </div>
      
      {error && (
        <p id="error-message" className="text-sm text-red-600">
          {error}
        </p>
      )}
      
      {hint && !error && (
        <p id="hint-message" className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

// Select Component
export const Select = forwardRef(({ 
  label,
  error,
  hint,
  options = [],
  placeholder = 'Selecciona una opción',
  className = '',
  containerClassName = '',
  ...props 
}, ref) => {
  
  return (
    <div className={clsx('space-y-1', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      
      <select
        ref={ref}
        className={clsx('input', className)}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value || option} 
            value={option.value || option}
          >
            {option.label || option}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

// Textarea Component
export const Textarea = forwardRef(({ 
  label,
  error,
  hint,
  className = '',
  containerClassName = '',
  rows = 4,
  ...props 
}, ref) => {
  
  return (
    <div className={clsx('space-y-1', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      
      <textarea
        ref={ref}
        rows={rows}
        className={clsx('input', className)}
        aria-invalid={!!error}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

// Radio Group Component
export function RadioGroup({ 
  label,
  name,
  options = [],
  value,
  onChange,
  className = '' 
}) {
  return (
    <fieldset className={clsx('space-y-2', className)}>
      {label && (
        <legend className="text-sm font-medium text-gray-600 mb-2">
          {label}
        </legend>
      )}
      
      <div className="space-y-2">
        {options.map((option) => (
          <label 
            key={option.value || option}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="radio"
              name={name}
              value={option.value || option}
              checked={value === (option.value || option)}
              onChange={(e) => onChange?.(e.target.value)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm group-hover:text-gray-900">
              {option.label || option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// Toggle Switch Component
export function Toggle({ 
  label,
  checked,
  onChange,
  className = '' 
}) {
  return (
    <label className={clsx('flex items-center gap-3 cursor-pointer', className)}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <div className={clsx(
          'w-14 h-8 rounded-full transition-colors',
          'bg-gray-300',
          {
            'bg-gradient-to-r from-blue-500 to-purple-500': checked
          }
        )}>
          <div className={clsx(
            'absolute top-1 left-1 w-6 h-6 rounded-full',
            'bg-white shadow-lg transition-transform',
            {
              'translate-x-6': checked
            }
          )} />
        </div>
      </div>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}