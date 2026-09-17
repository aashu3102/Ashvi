import type { RankedEvidence, Reranker } from "./types.js";

export class DefaultReranker implements Reranker {
  async rerank(query: string, candidates: RankedEvidence[]): Promise<RankedEvidence[]> {
    if (candidates.length <= 1) return [...candidates];

    const normalizedQuery = query.toLowerCase().trim();
    const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);

    const rescored = candidates.map((item) => {
      let boost = 0;

      // 1. Heading match boost (+0.15): If query terms match the section / slide / sheet title
      if (item.sectionHeading) {
        const normHeading = item.sectionHeading.toLowerCase();
        for (const token of queryTokens) {
          if (normHeading.includes(token)) {
            boost += 0.08;
          }
        }
      }

      // 2. Exact match in content boost (+0.1)
      if (item.content.toLowerCase().includes(normalizedQuery)) {
        boost += 0.1;
      }

      const finalScore = Number(Math.min(1.0, item.score + boost).toFixed(4));
      return {
        ...item,
        score: finalScore,
      };
    });

    // Re-sort descending
    rescored.sort((a, b) => b.score - a.score);
    return rescored;
  }
}
