
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95";
  
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10",
    outline: "border border-zinc-700 hover:border-white text-zinc-400 hover:text-white bg-transparent",
    ghost: "hover:bg-zinc-900 text-zinc-500 hover:text-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <i className="fas fa-circle-notch fa-spin"></i>
      ) : icon}
      {children}
    </button>
  );
};
