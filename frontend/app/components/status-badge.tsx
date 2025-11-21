'use client';

import { Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  status: 'not_generated' | 'generating' | 'ready' | 'error' | 'analyzing' | 'analyzed' | 'uploaded';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  const statusConfig = {
    not_generated: {
      color: 'text-text-tertiary',
      bg: 'bg-white/5',
      border: 'border-white/15',
      icon: null,
      text: 'Not Generated',
    },
    generating: {
      color: 'text-accent-warning',
      bg: 'bg-accent-warning/10',
      border: 'border-accent-warning/30',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      text: 'Generating',
    },
    analyzing: {
      color: 'text-accent-warning',
      bg: 'bg-accent-warning/10',
      border: 'border-accent-warning/30',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      text: 'Analyzing',
    },
    ready: {
      color: 'text-accent-success',
      bg: 'bg-accent-success/10',
      border: 'border-accent-success/30',
      icon: <div className="w-2 h-2 rounded-full bg-accent-success" />,
      text: 'Ready',
    },
    analyzed: {
      color: 'text-accent-success',
      bg: 'bg-accent-success/10',
      border: 'border-accent-success/30',
      icon: <div className="w-2 h-2 rounded-full bg-accent-success" />,
      text: 'Analyzed',
    },
    uploaded: {
      color: 'text-text-secondary',
      bg: 'bg-white/5',
      border: 'border-white/15',
      icon: <div className="w-2 h-2 rounded-full bg-text-secondary" />,
      text: 'Uploaded',
    },
    error: {
      color: 'text-accent-error',
      bg: 'bg-accent-error/10',
      border: 'border-accent-error/30',
      icon: <div className="w-2 h-2 rounded-full bg-accent-error" />,
      text: 'Error',
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border ${sizeClasses} ${config.color} ${config.bg} ${config.border} font-medium`}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
