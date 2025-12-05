import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { logger } from '../../lib/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface FertyFitChatProps {
  userId: string;
  dailyLimit?: number;
}

export const FertyFitChat = ({ userId, dailyLimit = 5 }: FertyFitChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingQuestions, setRemainingQuestions] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar historial de chat desde notifications
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Cargar mensajes de hoy
        const { data: todayChats, error: fetchError } = await supabase
          .from('notifications')
          .select('message, metadata, created_at')
          .eq('user_id', userId)
          .eq('type', 'CHAT')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .order('created_at', { ascending: true });

        if (fetchError) {
          logger.warn('Error al cargar historial de chat:', fetchError);
          return;
        }

        // Reconstruir conversación desde notifications
        // Cada notificación tiene la respuesta del asistente
        // Necesitamos también las preguntas del usuario (están en metadata.input.query)
        const chatMessages: ChatMessage[] = [];
        
        if (todayChats) {
          for (const chat of todayChats) {
            // Añadir pregunta del usuario (desde metadata)
            if (chat.metadata?.input?.query) {
              chatMessages.push({
                role: 'user',
                content: chat.metadata.input.query,
                timestamp: chat.created_at,
              });
            }
            
            // Añadir respuesta del asistente
            chatMessages.push({
              role: 'assistant',
              content: chat.message || '',
              timestamp: chat.created_at,
            });
          }
        }

        setMessages(chatMessages);
        
        // Calcular preguntas restantes
        const questionsCount = todayChats?.length || 0;
        setRemainingQuestions(Math.max(0, dailyLimit - questionsCount));
      } catch (err) {
        logger.warn('Error al cargar historial:', err);
      }
    };

    if (userId) {
      loadChatHistory();
    }
  }, [userId, dailyLimit]);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (remainingQuestions !== null && remainingQuestions <= 0) {
      setError(`Has alcanzado tu límite diario de ${dailyLimit} preguntas. Vuelve mañana.`);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsLoading(true);

    // Añadir mensaje del usuario inmediatamente
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // Construir historial de conversación (últimos 5 mensajes)
    const conversationHistory = messages
      .slice(-4) // Últimos 4 mensajes (2 pares pregunta-respuesta)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    try {
      const response = await fetch('/api/chat/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          query: userMessage,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setError(errorData.error || 'Has alcanzado tu límite diario de preguntas.');
          setRemainingQuestions(0);
        } else {
          setError(errorData.error || 'Error al enviar la pregunta. Intenta de nuevo.');
        }
        // Remover el mensaje del usuario si falló
        setMessages((prev) => prev.filter((msg) => msg !== newUserMessage));
        return;
      }

      const data = await response.json();
      
      // Añadir respuesta del asistente
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer || 'No se pudo generar una respuesta.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Actualizar preguntas restantes
      if (remainingQuestions !== null) {
        setRemainingQuestions(Math.max(0, remainingQuestions - 1));
      }
    } catch (err: any) {
      setError(err?.message || 'Error al enviar la pregunta. Intenta de nuevo.');
      // Remover el mensaje del usuario si falló
      setMessages((prev) => prev.filter((msg) => msg !== newUserMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border border-ferty-beige rounded-3xl shadow-sm overflow-hidden flex flex-col h-chat">
      {/* Header */}
      <div className="bg-ferty-beigeLight border-b border-ferty-beige p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-ferty-rose" />
            <h3 className="text-sm font-bold text-ferty-dark">Pregunta a FertyFit</h3>
          </div>
          {remainingQuestions !== null && (
            <div className="text-xs text-ferty-gray">
              <span className="font-semibold">{remainingQuestions}</span> preguntas restantes hoy
            </div>
          )}
        </div>
        <p className="text-xs text-ferty-gray mt-1">
          Haz tu pregunta sobre fertilidad y metodología FertyFit
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <MessageCircle size={48} className="text-ferty-rose opacity-30 mx-auto mb-3" />
              <p className="text-sm text-ferty-gray">
                Haz tu primera pregunta sobre fertilidad
              </p>
              <p className="text-xs text-ferty-coral mt-1">
                Ejemplo: "¿Qué es la reserva ovárica?"
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-ferty-gray text-white'
                    : 'bg-ferty-beigeLight text-ferty-dark border border-ferty-beige'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-ferty-rose" />
                <span className="text-sm text-ferty-gray">Pensando...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-ferty-beige p-4 bg-ferty-beigeLight">
        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-xl p-2">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading || (remainingQuestions !== null && remainingQuestions <= 0)}
            className="flex-1 border border-ferty-beige rounded-xl p-3 text-sm bg-white focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || (remainingQuestions !== null && remainingQuestions <= 0)}
            className="bg-ferty-gray text-white p-3 rounded-xl hover:bg-ferty-grayHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        {remainingQuestions !== null && remainingQuestions <= 0 && (
          <p className="text-xs text-ferty-coral mt-2 text-center">
            Límite diario alcanzado. Vuelve mañana o actualiza a premium.
          </p>
        )}
      </div>
    </div>
  );
};

