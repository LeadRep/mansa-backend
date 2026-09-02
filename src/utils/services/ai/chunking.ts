export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChunkingOptions {
  chunkSize?: number; // Target character length per chunk (default: 800)
  chunkOverlap?: number; // Overlap characters (default: 150)
  minChunkSize?: number; // Minimum characters (default: 100)
}

/**
 * Splits text recursively by paragraph, newline, sentence, and whitespace boundaries
 * with overlap to maintain semantic continuity.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): TextChunk[] {
  const chunkSize = options.chunkSize || 800;
  const chunkOverlap = options.chunkOverlap || 150;
  const minChunkSize = options.minChunkSize || 80;

  const normalized = text.trim();
  if (!normalized) return [];

  if (normalized.length <= chunkSize) {
    return [
      {
        chunkIndex: 0,
        content: normalized,
        tokenCount: estimateTokenCount(normalized),
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < normalized.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= normalized.length) {
      const finalSlice = normalized.slice(startIndex).trim();
      if (finalSlice.length >= minChunkSize || chunks.length === 0) {
        chunks.push({
          chunkIndex,
          content: finalSlice,
          tokenCount: estimateTokenCount(finalSlice),
        });
      }
      break;
    }

    // Try to find natural breaking point: paragraph, sentence, or word boundary
    const slice = normalized.slice(startIndex, endIndex);
    let breakOffset = -1;

    // 1. Paragraph boundary
    const lastParagraph = slice.lastIndexOf("\n\n");
    if (lastParagraph > chunkSize * 0.4) {
      breakOffset = lastParagraph + 2;
    }

    // 2. Sentence boundary (. ! ?)
    if (breakOffset === -1) {
      const sentenceMatch = slice.search(/([.!?])\s+[A-Z0-9]/g);
      const lastSentence = slice.lastIndexOf(". ");
      const lastExclamation = slice.lastIndexOf("! ");
      const lastQuestion = slice.lastIndexOf("? ");
      const bestSentence = Math.max(lastSentence, lastExclamation, lastQuestion);

      if (bestSentence > chunkSize * 0.4) {
        breakOffset = bestSentence + 2;
      }
    }

    // 3. Newline
    if (breakOffset === -1) {
      const lastNewline = slice.lastIndexOf("\n");
      if (lastNewline > chunkSize * 0.4) {
        breakOffset = lastNewline + 1;
      }
    }

    // 4. Space / word boundary
    if (breakOffset === -1) {
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > chunkSize * 0.4) {
        breakOffset = lastSpace + 1;
      }
    }

    // Fallback: strict cut
    if (breakOffset === -1) {
      breakOffset = chunkSize;
    }

    const chunkContent = normalized.slice(startIndex, startIndex + breakOffset).trim();
    if (chunkContent.length >= minChunkSize) {
      chunks.push({
        chunkIndex,
        content: chunkContent,
        tokenCount: estimateTokenCount(chunkContent),
      });
      chunkIndex++;
    }

    // Advance start index, backing up by overlap
    startIndex = startIndex + breakOffset - chunkOverlap;
    if (startIndex <= 0 || startIndex >= normalized.length) {
      break;
    }
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Approximation: ~4 characters per token in English
  return Math.ceil(text.length / 4);
}
