import { afterEach, describe, expect, it, vi } from 'vitest';

import { executePubmedSearch } from './pubmed';

vi.mock('undici', () => ({
  ProxyAgent: vi.fn(),
}));

describe('executePubmedSearch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not double-decode XML entities created from numeric ampersands', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          esearchresult: {
            count: '1',
            idlist: ['123'],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            uids: ['123'],
            '123': {
              uid: '123',
              title: 'Example',
              fulljournalname: 'Journal',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        xmlResponse(`
          <PubmedArticle>
            <PMID>123</PMID>
            <Abstract>
              <AbstractText>&#38;lt;b&#38;gt;safe&#x26;lt;/b&#x26;gt; &amp;lt;i&amp;gt;safe&amp;lt;/i&amp;gt;</AbstractText>
            </Abstract>
          </PubmedArticle>
        `),
      );

    const result = await executePubmedSearch({ query: 'example' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.articles[0]?.abstract).toBe(
      '&lt;b&gt;safe&lt;/b&gt; &lt;i&gt;safe&lt;/i&gt;',
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: { 'content-type': 'application/xml' },
  });
}
