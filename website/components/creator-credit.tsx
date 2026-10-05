import { creator } from "@/lib/shared";

export function CreatorCredit() {
  return (
    <div className="creator-credit">
      <p>
        Codeboard by <a href={creator.url}>{creator.name}</a>
      </p>
      <a href={creator.library}>
        Explore Nonom Library <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
