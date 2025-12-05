import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Star, Sparkles, ChevronDown, ChevronUp, Trash, Bell, X } from 'lucide-react';
import { AppNotification, NotificationAction } from '../types';

// --- Single Expandable Notification Card ---
export const NotificationList: React.FC<{
    notifications: AppNotification[];
    onMarkRead: (id: number) => void;
    deleteNotification: (id: number) => void;
    onAction?: (notification: AppNotification, action: NotificationAction) => void;
}> = ({ notifications, onMarkRead, deleteNotification, onAction }) => {
    const [expanded, setExpanded] = useState(false);

    if (notifications.length === 0) {
        return (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-ferty-beige text-center">
                <div className="w-12 h-12 bg-ferty-beige rounded-full flex items-center justify-center mx-auto mb-3 text-ferty-coral">
                    <Bell size={20} />
                </div>
                <p className="text-sm text-ferty-gray font-medium">No tienes notificaciones nuevas</p>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIconForType = (type: string) => {
        switch (type) {
            case 'celebration':
                return { icon: <Sparkles size={14} />, color: 'text-emerald-600' };
            case 'alert':
                return { icon: <AlertCircle size={14} />, color: 'text-rose-600' };
            case 'opportunity':
                return { icon: <Star size={14} />, color: 'text-amber-600' };
            case 'insight':
            case 'tip':
                return { icon: <Bell size={14} />, color: 'text-blue-600' };
            case 'confirmation':
                return { icon: <CheckCircle size={14} />, color: 'text-green-600' };
            default:
                // Fallback para tipos desconocidos (nunca debería llegar aquí con tipos estrictos)
                return { icon: <Bell size={14} />, color: 'text-ferty-coral' };
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} - ${hours}:${minutes}`;
    };

    return (
        <div className="bg-white border border-ferty-beige rounded-2xl shadow-sm overflow-hidden transition-all">
            {/* Header - Always visible */}
            <div
                onClick={() => setExpanded(!expanded)}
                className="p-4 cursor-pointer hover:bg-ferty-beige/30 transition-colors"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 rounded-full bg-ferty-rose/10 text-ferty-rose">
                            <Bell size={16} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-ferty-dark flex items-center gap-2">
                                Notificaciones
                                {unreadCount > 0 && (
                                    <span className="bg-ferty-rose text-white text-[10px] px-2 py-0.5 rounded-full">
                                        {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-ferty-gray mt-1">
                                {notifications.length} total{notifications.length > 1 ? 'es' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded ? <ChevronUp size={20} className="text-ferty-gray" /> : <ChevronDown size={20} className="text-ferty-gray" />}
                    </div>
                </div>
            </div>

            {/* Expanded Content - Simple list */}
            {expanded && (
                <div className="px-4 pb-4 pt-2 border-t border-ferty-beige bg-ferty-beigeLight space-y-3">
                    {notifications.map((notif) => {
                        const { icon, color } = getIconForType(notif.type);
                        const actions = Array.isArray(notif.metadata?.actions) ? notif.metadata.actions : [];
                        const hasActions = actions.length > 0;
                        return (
                            <div
                                key={notif.id}
                                className="flex items-start gap-2 py-2 border-b border-ferty-beige/50 last:border-0"
                            >
                                {/* Icon */}
                                <div className={`shrink-0 ${color} mt-1`}>
                                    {icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-sm font-bold text-ferty-dark">{notif.title}</h4>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!notif.is_read && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-ferty-rose"></span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notif.id);
                                                }}
                                                className="text-stone-300 hover:text-rose-400 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-xs text-ferty-gray leading-relaxed mb-2">
                                        {notif.message}
                                    </p>

                                    {hasActions && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {actions.map(action => (
                                                <button
                                                    key={`${notif.id}-${action.value}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAction?.(notif, action);
                                                    }}
                                                    className="px-3 py-1 text-[11px] font-bold rounded-full border border-ferty-rose text-ferty-rose hover:bg-ferty-rose hover:text-white transition-colors"
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 text-[10px]">
                                        <span className="text-ferty-coral font-medium">
                                            {formatTime(notif.created_at)}
                                        </span>
                                        {!notif.is_read && !hasActions && (
                                            <>
                                                <span className="text-stone-300">•</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onMarkRead(notif.id);
                                                    }}
                                                    className="font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
                                                >
                                                    Marcar leída
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
