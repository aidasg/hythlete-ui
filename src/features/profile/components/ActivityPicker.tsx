import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Sport } from "@/features/profile/services/profileModel";
import { sportCode } from "@/features/profile/services/profileModel";

type ActivityPickerProps = {
  sports: Sport[];
  selectedIds: number[];
  favoriteIds?: number[];
  onAdd: (sport: Sport) => void;
  onClose: () => void;
};

export function ActivityPicker({ sports, selectedIds, favoriteIds, onAdd, onClose }: ActivityPickerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(
    () => [...new Set(sports.map((sport) => sport.training_category || "other"))].sort(),
    [sports]
  );
  const available = useMemo(() => sports.filter((sport) =>
    typeof sport.id === "number" &&
    !["amrap", "emom", "tabata"].includes(sport.code || "") &&
    !selectedIds.includes(sport.id) &&
    (category === "all" || (sport.training_category || "other") === category) &&
    (sport.name || "").toLowerCase().includes(search.trim().toLowerCase())
  ), [sports, selectedIds, category, search]);
  const grouped = useMemo(() => {
    const groups = new Map<string, Sport[]>();
    const favorites = available.filter(sport => favoriteIds?.includes(sport.id!));
    if (favorites.length) groups.set("favorites|My activities", favorites);
    for (const sport of available) {
      if (favoriteIds?.includes(sport.id!)) continue;
      const family = sport.parent_code || sportCode(sport);
      const parent = sports.find((item) => sportCode(item) === family);
      const label = sport.parent_code ? parent?.name || family.replace(/_/g, " ") : sport.name || "Other";
      const group = `${sport.training_category || "other"}|${label}`;
      groups.set(group, [...(groups.get(group) || []), sport]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.startsWith("favorites|") ? -1 : b.startsWith("favorites|") ? 1 : a.localeCompare(b));
  }, [available, sports, favoriteIds]);

  return (
    <div className="activity-picker" role="region" aria-label="Add activity">
      <div className="activity-picker-heading">
        <strong>Find an activity</strong>
        <button type="button" className="icon-button" aria-label="Close activity picker" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <label className="activity-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search activities</span>
        <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter") {
            event.preventDefault();
            if (available.length === 1 && available[0]) onAdd(available[0]);
          }
        }} placeholder="Search activities" />
      </label>
      <div className="activity-categories" aria-label="Activity categories">
        <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
        {categories.map((item) => (
          <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>
            {item.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div className="activity-results" role="list" aria-label="Available activities">
        {grouped.length ? grouped.map(([group, items]) => {
          const [trainingCategory = "other", family = "Other"] = group.split("|");
          return (
            <div className="activity-result-group" role="listitem" key={group}>
              <span>{family} <small>{trainingCategory === "favorites" ? "profile favorites" : trainingCategory.replace(/_/g, " ")}</small></span>
              {items.map((sport) => (
                <button type="button" key={sport.id} onClick={() => onAdd(sport)}>
                  {sport.name}
                </button>
              ))}
            </div>
          );
        }) : <p>No matching activities. Try another search.</p>}
      </div>
    </div>
  );
}
