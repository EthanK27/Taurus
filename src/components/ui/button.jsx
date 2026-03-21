export function Button({ variant = 'default', className = '', type = 'button', ...props }) {
  const baseClassName = 'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
  const variantClassName = variant === 'outline'
    ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
    : 'bg-slate-900 text-white hover:bg-slate-800'

  return <button type={type} className={`${baseClassName} ${variantClassName} ${className}`.trim()} {...props} />
}