'use client';

interface BattleControlsProps {
  currentTick: number;
  totalTicks: number;
  playbackSpeed: 1 | 2 | 4;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onSeek: (tick: number) => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
  ticksPerSecond: number;
}

export default function BattleControls({
  currentTick,
  totalTicks,
  playbackSpeed,
  isPlaying,
  onPlay,
  onPause,
  onStepForward,
  onStepBack,
  onSeek,
  onSpeedChange,
  ticksPerSecond,
}: BattleControlsProps) {
  const timeSeconds = totalTicks > 0 ? (currentTick / ticksPerSecond).toFixed(1) : '0.0';
  const totalSeconds = totalTicks > 0 ? (totalTicks / ticksPerSecond).toFixed(1) : '0.0';
  const progress = totalTicks > 0 ? (currentTick / totalTicks) * 100 : 0;

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-3 space-y-2">
      {/* Seek slider */}
      <div className="relative">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, totalTicks - 1)}
          value={currentTick}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Time display */}
        <div className="text-xs text-gray-500 font-mono min-w-[70px] lg:min-w-[100px]">
          {timeSeconds}s / {totalSeconds}s
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-1">
          {/* Step back */}
          <button
            onClick={onStepBack}
            disabled={currentTick <= 0}
            className="p-1.5 rounded-md bg-[#1f2937] hover:bg-[#374151] disabled:opacity-30 text-gray-300 text-xs transition-colors"
            title="이전 틱"
          >
            ⏮
          </button>

          {/* Play / Pause */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={totalTicks === 0}
            className="p-1.5 px-3 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-sm font-bold transition-colors"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Step forward */}
          <button
            onClick={onStepForward}
            disabled={currentTick >= totalTicks - 1}
            className="p-1.5 rounded-md bg-[#1f2937] hover:bg-[#374151] disabled:opacity-30 text-gray-300 text-xs transition-colors"
            title="다음 틱"
          >
            ⏭
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1 min-w-[70px] lg:min-w-[100px] justify-end">
          {([1, 2, 4] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                playbackSpeed === s
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1f2937] text-gray-500 hover:text-gray-300'
              }`}
            >
              x{s}
            </button>
          ))}
        </div>
      </div>

      {/* Tick info */}
      <div className="text-[10px] text-gray-600 text-center">
        Tick {currentTick} / {totalTicks}
      </div>
    </div>
  );
}
