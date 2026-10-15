import {
  assertAuditableUrl,
  getUrlLang,
  isAnalyticsRequest,
  rebuildDocument,
  WET_BOEW_SCRIPTS,
  WET_BOEW_STYLESHEETS,
} from './axe-core.utils';

describe('assertAuditableUrl', () => {
  it.concurrent('should allow canada.ca and its subdomains', () => {
    expect(() =>
      assertAuditableUrl('https://www.canada.ca/en/revenue-agency/x.html'),
    ).not.toThrow();

    expect(() =>
      assertAuditableUrl('https://canada.ca/fr/x.html'),
    ).not.toThrow();
  });

  it.concurrent('should block link-local and private addresses', () => {
    expect(() =>
      assertAuditableUrl('http://169.254.169.254/latest/meta-data/'),
    ).toThrow();

    expect(() => assertAuditableUrl('http://localhost:9000/admin')).toThrow();
    expect(() => assertAuditableUrl('http://10.0.0.5/internal')).toThrow();
  });

  it.concurrent(
    'should block hostnames that merely end with the allowed one',
    () => {
      expect(() =>
        assertAuditableUrl('https://evilcanada.ca/payload'),
      ).toThrow();
    },
  );

  it.concurrent('should block the allowed host used as a subdomain', () => {
    expect(() =>
      assertAuditableUrl('https://canada.ca.attacker.com/x'),
    ).toThrow();
  });

  it.concurrent('should block non-http protocols', () => {
    expect(() => assertAuditableUrl('file:///etc/passwd')).toThrow();
  });

  it.concurrent('should throw on a malformed url', () => {
    expect(() => assertAuditableUrl('not-a-url')).toThrow();
  });
});

describe('isAnalyticsRequest', () => {
  it.concurrent('should match the analytics hosts canada.ca loads', () => {
    expect(isAnalyticsRequest('https://assets.adobedtm.com/x.js')).toBe(true);
    expect(isAnalyticsRequest('https://s.go-mpulse.net/boomerang/')).toBe(true);
    expect(isAnalyticsRequest('https://dpm.demdex.net/id')).toBe(true);
    expect(isAnalyticsRequest('https://canada.tt.omtrdc.net/m2')).toBe(true);
    expect(isAnalyticsRequest('https://cm.everesttech.net/cm')).toBe(true);
  });

  it.concurrent('should not match assets the audit needs', () => {
    expect(isAnalyticsRequest('https://www.canada.ca/theme.css')).toBe(false);
    expect(
      isAnalyticsRequest('https://cdn.design-system.alpha.canada.ca/a.css'),
    ).toBe(false);
    expect(
      isAnalyticsRequest('https://ajax.googleapis.com/jquery.min.js'),
    ).toBe(false);
    expect(isAnalyticsRequest('https://fonts.gstatic.com/f.woff2')).toBe(false);
  });

  it.concurrent(
    'should not match a host merely ending with a blocked domain',
    () => {
      expect(isAnalyticsRequest('https://notdoubleclick.net/x')).toBe(false);
    },
  );

  it.concurrent('should return false for a malformed url', () => {
    expect(isAnalyticsRequest('not-a-url')).toBe(false);
  });
});

describe('getUrlLang', () => {
  it.concurrent('should read the language segment from a canada.ca url', () => {
    expect(getUrlLang('https://www.canada.ca/fr/agence-revenu/x.html')).toBe(
      'fr',
    );
    expect(getUrlLang('https://www.canada.ca/en/revenue-agency/x.html')).toBe(
      'en',
    );
  });

  it.concurrent(
    'should fall back to en when there is no language segment',
    () => {
      expect(getUrlLang('https://www.canada.ca/x.html')).toBe('en');
    },
  );
});

describe('rebuildDocument', () => {
  it.concurrent('should restore the lang attribute a snapshot has lost', () => {
    const doc = rebuildDocument('<main>x</main>', 'fr');

    expect(doc).toContain('<html lang="fr"');
    expect(doc).toContain('<!doctype html>');
  });

  it.concurrent(
    'should add a base href so relative stylesheets resolve',
    () => {
      expect(rebuildDocument('<main>x</main>', 'en')).toContain(
        '<base href="https://www.canada.ca/">',
      );
    },
  );

  it.concurrent('should keep the snapshot content', () => {
    expect(rebuildDocument('<main><p>hello</p></main>', 'en')).toContain(
      '<main><p>hello</p></main>',
    );
  });

  it.concurrent('should leave an already-complete document untouched', () => {
    const doc = '<!doctype html><html lang="en"><body>y</body></html>';

    expect(rebuildDocument(doc, 'fr')).toBe(doc);
  });

  it.concurrent('should omit scripts by default', () => {
    expect(rebuildDocument('<main>x</main>', 'en')).not.toContain('<script');
  });

  it.concurrent('should inject the WET-BOEW bundle when asked', () => {
    const doc = rebuildDocument('<main>x</main>', 'en', { withScripts: true });

    for (const src of WET_BOEW_SCRIPTS) {
      expect(doc).toContain(src);
    }
  });

  it.concurrent('should never inject analytics with the bundle', () => {
    const doc = rebuildDocument('<main>x</main>', 'en', { withScripts: true });

    expect(WET_BOEW_SCRIPTS.some((src) => isAnalyticsRequest(src))).toBe(false);
    expect(doc).not.toContain('adobedtm');
    expect(doc).not.toContain('mpulse');
  });

  it.concurrent('should wrap a stored body in a main landmark', () => {
    expect(rebuildDocument('<h1>x</h1>', 'en')).toContain(
      '<body><main><h1>x</h1></main>',
    );
  });

  it.concurrent('should not nest a main the snapshot already has', () => {
    const doc = rebuildDocument('<main><h1>x</h1></main>', 'en');

    expect(doc).not.toContain('<main><main>');
    expect(doc).toContain('<body><main><h1>x</h1></main>');
  });

  it.concurrent('should inject the theme stylesheet for contrast', () => {
    const doc = rebuildDocument('<h1>x</h1>', 'en');

    for (const href of WET_BOEW_STYLESHEETS) {
      expect(doc).toContain(`<link rel="stylesheet" href="${href}">`);
    }
  });

  it.concurrent('should inject stylesheets even without scripts', () => {
    const doc = rebuildDocument('<h1>x</h1>', 'en', { withScripts: false });

    expect(doc).not.toContain('<script');
    expect(doc).toContain('theme.min.css');
  });

  it.concurrent('should restore the stored title when given one', () => {
    expect(
      rebuildDocument('<h1>x</h1>', 'en', { title: 'Child benefit' }),
    ).toContain('<title>Child benefit</title>');
  });

  it.concurrent('should omit the title element when none is stored', () => {
    expect(rebuildDocument('<h1>x</h1>', 'en')).not.toContain('<title>');
  });

  it.concurrent('should escape markup in a stored title', () => {
    const doc = rebuildDocument('<h1>x</h1>', 'en', {
      title: 'Benefits & credits <script>',
    });

    expect(doc).toContain(
      '<title>Benefits &amp; credits &lt;script&gt;</title>',
    );
    expect(doc).not.toContain('<title>Benefits & credits <script>');
  });
});
