'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DemoRequestModal } from '@/components/demo-request-modal'

interface Props {
  variant?: 'outline' | 'default' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  label?: string
}

export function BookDemoButton({ variant = 'outline', size = 'sm', className, label = 'Book Demo' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <DemoRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
