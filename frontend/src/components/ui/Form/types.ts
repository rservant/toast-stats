import {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  LabelHTMLAttributes,
} from 'react'

// Base form component props
export interface BaseFormProps {
  className?: string
  children?: ReactNode
}

// Form Field Props
export interface FormFieldProps extends BaseFormProps {
  error?: boolean
  disabled?: boolean
  required?: boolean
}

// Form Label Props
export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  className?: string
  required?: boolean
  children: ReactNode
}

// Form Input Props
export interface FormInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  className?: string
  error?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Form Textarea Props
export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
  error?: boolean
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

// Form Select Props
export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
  error?: boolean
  placeholder?: string
}

// Form Checkbox Props
export interface FormCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  className?: string
  label?: string
  error?: boolean
}

// Form Radio Props
export interface FormRadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  className?: string
  label?: string
  error?: boolean
}

// Form Helper Text Props
export interface FormHelperTextProps extends BaseFormProps {
  variant?: 'default' | 'error'
}

// Form Error Message Props
export interface FormErrorMessageProps extends BaseFormProps {
  variant?: 'error'
}
