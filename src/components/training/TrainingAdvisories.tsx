import { TriangleAlert } from "lucide-react";
import type { components } from "@/services/api/types";

type TrainingAdvisory = components["schemas"]["workout.TrainingAdvisory"];

export function TrainingAdvisories({ items }: { items?: TrainingAdvisory[] }) {
  if (!items?.length) return null;
  const groups = [
    { source: "athlete_report", title: "Your reported symptoms" },
    { source: "load_estimate", title: "Estimated training load" },
  ];
  return <aside className="training-advisories" aria-label="Training advice">
    {groups.map(group => {
      const advice = items.filter(item => item.source === group.source);
      if (!advice.length) return null;
      return <section key={group.source} data-source={group.source}>
        <h4><TriangleAlert size={16} aria-hidden="true" />{group.title}</h4>
        <ul>{advice.map((item, index) => <li key={`${item.code}:${item.entity_type}:${item.entity_id}:${item.date}:${index}`} data-concern={item.concern}>
          {item.date && <time dateTime={item.date}>{item.date}</time>} {item.message}
        </li>)}</ul>
      </section>;
    })}
  </aside>;
}
