/**
 * Index workspace transactions by emitted event topic for fast search. (#921)
 */
export interface IndexedTransaction {
  hash: string;
  eventTopics: string[];
}

export type EventTopicIndex = Map<string, Set<string>>;

export function buildEventTopicIndex(transactions: IndexedTransaction[]): EventTopicIndex {
  const index: EventTopicIndex = new Map();

  for (const tx of transactions) {
    for (const topic of tx.eventTopics) {
      if (!index.has(topic)) {
        index.set(topic, new Set());
      }
      index.get(topic)!.add(tx.hash);
    }
  }

  return index;
}

export function searchByTopic(index: EventTopicIndex, topic: string): string[] {
  const matches = new Set<string>();
  for (const [key, hashes] of index) {
    if (key.toLowerCase().includes(topic.toLowerCase())) {
      hashes.forEach((h) => matches.add(h));
    }
  }
  return [...matches];
}
