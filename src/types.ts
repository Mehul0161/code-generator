export interface CalculatorProps {
  display: string;
  equation: string;
  onNumberClick: (num: string) => void;
  onOperatorClick: (op: string) => void;
  onClear: () => void;
  onEqual: () => void;
}

export interface DisplayProps {
  value: string;
  equation: string;
}

export interface ButtonProps {
  value: string;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
} 