import type { Player } from "@/types";

interface Props {
  players: Player[];
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}

export default function LobbyStep({ players, loading, error, selected, onToggle, onNext }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <p className="text-gray-600 text-sm text-center py-8">
        No players found. Add players in the Players tab first.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              selected.has(p.id)
                ? "border-[#00d4ff] bg-[#00d4ff]/10"
                : "border-[#2a2a2a] bg-[#1a1a1a]"
            }`}
          >
            <span className="text-2xl">{p.character_avatar}</span>
            <span className="text-white text-sm font-semibold truncate">{p.name}</span>
            {selected.has(p.id) && (
              <span className="ml-auto text-[#00d4ff] text-lg">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="sticky bottom-0 bg-[#0a0a0a] pt-2 pb-1">
        <button
          onClick={onNext}
          disabled={selected.size === 0}
          className="w-full py-4 bg-[#00d4ff] text-black font-black text-base rounded-xl disabled:opacity-40 transition-opacity tracking-wide"
        >
          Next → Assign Positions ({selected.size} selected)
        </button>
      </div>
    </>
  );
}
