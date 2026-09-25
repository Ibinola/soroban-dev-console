/**
 * Helpers for filtering contract event topics by string or hex encoding.
 */

export type TopicEncoding = 'string' | 'hex';

export interface TopicFilterOptions {
  query: string;
  encoding: TopicEncoding;
}

export function filterEventTopics(topics: string[], options: TopicFilterOptions): boolean {
  if (!options.query || options.query.trim() === '') return true;

  const normalizedQuery = options.query.trim().toLowerCase();

  return topics.some(topic => {
    const normalizedTopic = topic.toLowerCase();
    if (options.encoding === 'hex') {
      return normalizedTopic.includes(normalizedQuery.replace(/^0x/, ''));
    }
    return normalizedTopic.includes(normalizedQuery);
  });
}
