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
    <div className="pb-24 pt-0 h-[calc(100vh-96px)] flex flex-col">
      <div className="px-5 pt-0 flex flex-col h-full">
        {/* Header compacto */}
        <div className="flex-shrink-0 py-3">
          <div>
            <h2 className="text-xl font-bold text-ferty-dark mb-0.5">Chat</h2>
            <p className="text-[10px] text-ferty-gray">
              Haz preguntas sobre tu fertilidad y recibe respuestas personalizadas basadas en tu perfil.
            </p>
          </div>
        </div>

        {/* Chat FertyFit - ocupa el resto del espacio */}
        <div className="flex-1 overflow-hidden min-h-0">
          {user?.id && (
            <FertyFitChat userId={user.id} dailyLimit={5} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;

