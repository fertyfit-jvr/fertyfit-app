import { ReactNode } from 'react';

interface InputFieldProps {
  label: string;
  children?: ReactNode;
}

const InputField = ({ label, children }: InputFieldProps) => (
  <div className="mb-4">
    <label className="block text-xs font-bold text-ferty-dark uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
);

export default InputField;

