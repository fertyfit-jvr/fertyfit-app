import React from 'react';
import { UserProfile, ViewState } from '../../types';
import { FertyFitChat } from '../../components/chat/FertyFitChat';

interface ChatViewProps {
  user: UserProfile;
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
}

const ChatView = ({
  user,
  showNotif,
  setView
}: ChatViewProps) => {
  return (
    <div className="h-screen flex flex-col pb-24 pt-0">
      {/* Header compacto fijo arriba */}
      <div className="flex-shrink-0 px-5 pt-2 pb-3 border-b border-ferty-beige bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ferty-dark mb-0.5">Chat</h2>
            <p className="text-[10px] text-ferty-gray">
              Haz preguntas sobre tu fertilidad y recibe respuestas personalizadas basadas en tu perfil.
            </p>
          </div>
          <button
            onClick={() => setView('CONSULTATIONS')}
            className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
          >
            Volver
          </button>
        </div>
      </div>

      {/* Chat FertyFit - ocupa el resto del espacio */}
      <div className="flex-1 overflow-hidden">
        {user?.id && (
          <div className="h-full">
            <FertyFitChat userId={user.id} dailyLimit={5} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatView;

