import { describe, expect, it } from 'vitest';
import { featureFlags } from '@/config';
import { invitationPath } from '@/lib/codes-format';

describe('Presentation Mode', () => {
  it('has features.presentationMode enabled in config', () => {
    expect(featureFlags.presentationMode).toBe(true);
  });

  it('formats the presentation scan URL correctly', () => {
    const path = invitationPath('ABCD1234');
    expect(path).toBe('/i/ABCD1234');
  });

  describe('carousel index math', () => {
    function nextIndex(currentIndex: number, totalPosts: number): number {
      if (totalPosts === 0) return 0;
      return (currentIndex + 1) % totalPosts;
    }

    function prevIndex(currentIndex: number, totalPosts: number): number {
      if (totalPosts === 0) return 0;
      return (currentIndex - 1 + totalPosts) % totalPosts;
    }

    it('handles advancing slides cleanly', () => {
      expect(nextIndex(0, 3)).toBe(1);
      expect(nextIndex(1, 3)).toBe(2);
      expect(nextIndex(2, 3)).toBe(0); // wraps around
    });

    it('handles reversing slides cleanly', () => {
      expect(prevIndex(0, 3)).toBe(2); // wraps to last
      expect(prevIndex(2, 3)).toBe(1);
      expect(prevIndex(1, 3)).toBe(0);
    });

    it('handles edge case of 0 or 1 post', () => {
      expect(nextIndex(0, 0)).toBe(0);
      expect(prevIndex(0, 0)).toBe(0);
      expect(nextIndex(0, 1)).toBe(0);
      expect(prevIndex(0, 1)).toBe(0);
    });
  });
});
