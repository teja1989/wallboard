import { describe, expect, it } from 'vitest';
import { occasions, occasionById, registryHostLabel, registryLimits } from '@/config';
import { addRegistryLinkSchema, registryLinkIdSchema } from '@/lib/validation/schemas';

describe('which occasions carry a gift list', () => {
  it('never asks at a memorial or a work event', () => {
    // The reason this is a property of the occasion rather than a host setting: the two
    // places where a gift list would be a genuine faux pas are exactly the two nobody would
    // think to switch off.
    expect(occasionById('memorial').giftsExpected).toBe(false);
    expect(occasionById('work').giftsExpected).toBe(false);
  });

  it('asks at the occasions where somebody is already wondering what to buy', () => {
    for (const id of ['birthday', 'wedding', 'baby', 'graduation']) {
      expect(occasionById(id).giftsExpected, id).toBe(true);
    }
  });

  it('is declared on every occasion, so a new one cannot default into asking', () => {
    for (const occasion of occasions) {
      expect(typeof occasion.giftsExpected, occasion.id).toBe('boolean');
    }
  });

  it('never expects gifts at a somber occasion', () => {
    for (const occasion of occasions) {
      if (occasion.somber) expect(occasion.giftsExpected, occasion.id).toBe(false);
    }
  });
});

describe('naming a link', () => {
  it('recognises the big registries by their registrable domain', () => {
    expect(registryHostLabel('https://www.amazon.com/wedding/registry/ABC')).toBe('Amazon');
    // Regional storefronts are the same shop, so matching the whole hostname would be wrong.
    expect(registryHostLabel('https://amazon.co.uk/baby-reg/xyz')).toBe('Amazon');
    expect(registryHostLabel('https://www.zola.com/registry/priyaandsam')).toBe('Zola');
  });

  it('falls back to the bare hostname for the long tail', () => {
    expect(registryHostLabel('https://www.thelittletoyshop.co.uk/list/12')).toBe(
      'thelittletoyshop.co.uk',
    );
  });

  it('never throws on something that is not a URL', () => {
    // The stored value is always validated, but this also renders drafts the host is typing.
    expect(registryHostLabel('not a url')).toBe('Link');
    expect(registryHostLabel('')).toBe('Link');
  });
});

describe('the add-a-link schema', () => {
  it('requires a destination', () => {
    expect(addRegistryLinkSchema.safeParse({ url: '' }).success).toBe(false);
  });

  it('refuses anything that is not http(s)', () => {
    // A registry row is a link we render for two hundred guests to tap.
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
      expect(addRegistryLinkSchema.safeParse({ url }).success, url).toBe(false);
    }
  });

  it('accepts a link with no name, because the server names it', () => {
    const parsed = addRegistryLinkSchema.parse({ url: 'https://amazon.com/x' });
    expect(parsed.label).toBe('');
    expect(parsed.note).toBe('');
  });

  it('bounds the label and the note to what the config says', () => {
    const tooLong = addRegistryLinkSchema.safeParse({
      url: 'https://example.com',
      label: 'x'.repeat(registryLimits.labelMaxLength + 1),
    });
    expect(tooLong.success).toBe(false);
  });
});

describe('link ids', () => {
  it('accept the twelve-character ids the service mints', () => {
    // base64url of nine bytes. Asserted because the DELETE route parses ids through this.
    expect(registryLinkIdSchema.safeParse('AbC123_-xyz9').success).toBe(true);
  });

  it('cannot match the sibling beacon route', () => {
    // `registry/click` is a static segment and Next resolves it first, so this is belt and
    // braces — but if the id scheme ever shortened, this is where it would be noticed.
    expect(registryLinkIdSchema.safeParse('click').success).toBe(false);
  });
});
