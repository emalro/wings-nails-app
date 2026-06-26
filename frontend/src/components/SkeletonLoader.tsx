import React from 'react'

interface SkeletonLoaderProps {
  lines?: number
  className?: string
  variant?: 'text' | 'card' | 'table'
}

export function SkeletonLoader({ lines = 3, className = '', variant = 'text' }: SkeletonLoaderProps) {
  const baseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded'

  if (variant === 'card') {
    return (
      <div className={`space-y-4 p-4 ${className}`}>
        <div className={`${baseClass} h-6 w-3/4`} />
        <div className={`${baseClass} h-4 w-full`} />
        <div className={`${baseClass} h-4 w-5/6`} />
        <div className={`${baseClass} h-10 w-1/3 mt-4`} />
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className={`${baseClass} h-10 w-full`} />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`${baseClass} h-8 w-full`} />
        ))}
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} h-4`}
          style={{ width: `${85 - i * 10}%` }}
        />
      ))}
    </div>
  )
}
