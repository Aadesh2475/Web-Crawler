"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from "react"

// ── Context ──────────────────────────────────────────────────────────────────

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false, value: "", setValue: () => {}, maxHeight: 200,
})

function usePromptInput() {
  return useContext(PromptInputContext)
}

// ── PromptInput (container) ───────────────────────────────────────────────────

type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function PromptInput({
  isLoading = false, maxHeight = 200, value, onValueChange, onSubmit, children, style,
}: PromptInputProps) {
  const [internal, setInternal] = useState(value ?? "")
  const handleChange = (v: string) => { setInternal(v); onValueChange?.(v) }

  return (
    <PromptInputContext.Provider value={{
      isLoading, value: value ?? internal,
      setValue: onValueChange ?? handleChange,
      maxHeight, onSubmit,
    }}>
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--bg)',
        padding: '6px 8px',
        boxShadow: 'var(--shadow-xs)',
        ...style,
      }}>
        {children}
      </div>
    </PromptInputContext.Provider>
  )
}

// ── PromptInputTextarea ───────────────────────────────────────────────────────

export type PromptInputTextareaProps = {
  disableAutosize?: boolean
  placeholder?: string
  style?: React.CSSProperties
}

function PromptInputTextarea({ disableAutosize = false, placeholder, style }: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput()
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (disableAutosize || !ref.current) return
    ref.current.style.height = "auto"
    const sh = ref.current.scrollHeight
    const max = typeof maxHeight === "number" ? maxHeight : 200
    ref.current.style.height = `${Math.min(sh, max)}px`
  }, [value, maxHeight, disableAutosize])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.() }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      style={{
        width: '100%',
        minHeight: 40,
        resize: 'none',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: 'inherit',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
        padding: '4px 4px',
        ...style,
      }}
    />
  )
}

// ── PromptInputActions ────────────────────────────────────────────────────────

type PromptInputActionsProps = {
  children: React.ReactNode
  style?: React.CSSProperties
}

function PromptInputActions({ children, style }: PromptInputActionsProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      paddingTop: 4,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── PromptInputAction (simple tooltip wrapper) ────────────────────────────────

type PromptInputActionProps = {
  tooltip?: React.ReactNode
  children: React.ReactNode
}

function PromptInputAction({ children }: PromptInputActionProps) {
  return <>{children}</>
}

export { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction }
