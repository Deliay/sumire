"use client";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export default function SearchBox({ value, onChange, onSearch }: SearchBoxProps) {
  return (
    <div className="relative w-full">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-dim"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch();
        }}
        aria-label="弹幕检索关键词"
        maxLength={200}
        placeholder="搜索弹幕内容…"
        className="w-full rounded-md border border-vine/50 bg-transparent py-2 pr-10 pl-10 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim/50 focus:border-flower"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim transition-colors hover:text-ink"
          aria-label="清除搜索"
        >
          ×
        </button>
      )}
    </div>
  );
}
