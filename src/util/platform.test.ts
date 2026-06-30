import { describe, it, expect } from 'vitest';
import { isMobileUserAgent } from './platform';

describe('isMobileUserAgent', () => {
  it('flags common mobile user agents', () => {
    expect(
      isMobileUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(true);
    expect(
      isMobileUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile'),
    ).toBe(true);
    expect(isMobileUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('does not flag desktop user agents', () => {
    expect(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe(
      false,
    );
    expect(
      isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'),
    ).toBe(false);
  });
});
