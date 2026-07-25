import { Bot, User } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export function ChatMessage({ message }: { message: Message }) {
  const isBot = message.role === 'bot';

  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isBot ? 'bg-primary-100' : 'bg-secondary-100'
      }`}>
        {isBot ? (
          <Bot className="w-4 h-4 text-primary-700" />
        ) : (
          <User className="w-4 h-4 text-secondary-600" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isBot
          ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
          : 'bg-primary-700 text-white rounded-tr-sm'
      }`}>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
