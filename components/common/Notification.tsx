import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification = ({ message, type, onClose }: NotificationProps) => (
  <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right duration-300 ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
    {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
    <p className="text-sm font-bold">{message}</p>
    <button onClick={onClose}>
      <X size={16} className="opacity-50 hover:opacity-100" />
    </button>
  </div>
);

export default Notification;

