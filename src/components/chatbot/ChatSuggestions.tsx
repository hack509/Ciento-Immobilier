import { Home, TrendingUp, MapPin, FileText } from 'lucide-react';

const suggestions = [
  {
    icon: Home,
    text: 'Quel est le prix moyen d\'une maison aux Gonaïves ?',
  },
  {
    icon: TrendingUp,
    text: 'Comment est le marché immobilier à Port-au-Prince ?',
  },
  {
    icon: MapPin,
    text: 'Quels quartiers sont sûrs pour acheter un terrain ?',
  },
  {
    icon: FileText,
    text: 'Quels documents faut-il pour vendre un bien ?',
  },
];

export function ChatSuggestions({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="px-4 pb-3">
      <p className="text-xs text-gray-400 mb-2">Suggestions :</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.text}
              onClick={() => onSelect(s.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-secondary-400 hover:text-secondary-600 transition-colors text-left"
            >
              <Icon className="w-3 h-3 shrink-0" />
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
