import { LucideIcon } from 'lucide-react';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

const NavButton = ({ active, onClick, icon: Icon, label }: NavButtonProps) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full py-2 transition-colors duration-200 ${
      active ? 'text-[#C7958E]' : 'text-[#5D7180] opacity-60 hover:opacity-100'
    }`}
  >
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] mt-1 font-medium uppercase tracking-wide">{label}</span>
  </button>
);

export default NavButton;

