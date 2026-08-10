"use client";

export type TabDef = { id: string; label: string };

export function Tabbar({
  tabs,
  activeId,
  onChange,
}: {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          className={tab.id === activeId ? "active" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
