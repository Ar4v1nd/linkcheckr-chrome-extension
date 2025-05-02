'use strict';

import { Readability } from '@mozilla/readability';

const MAX_CACHE_SIZE = 1000; // Maximum number of cached links
const documentClone = document.cloneNode(true);
const reader = new Readability(documentClone);
const article = reader.parse();

if (article && article.content) {
  const temp = document.createElement('div');
  temp.innerHTML = article.content;

  const seen = new Set();
  const linkElements = Array.from(document.querySelectorAll('a[href]'));

  const getCachedStatus = (url) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['linkStatusCache'], (result) => {
        const cache = result.linkStatusCache || {};
        resolve(cache[url]);
      });
    });
  };

  const setCachedStatus = (url, status) => {
    chrome.storage.local.get(['linkStatusCache'], (result) => {
      let cache = result.linkStatusCache || {};

      cache[url] = {
        status,
        timestamp: Date.now(),
      };

      // Enforce cache size limit
      const keys = Object.keys(cache);
      if (keys.length > MAX_CACHE_SIZE) {
        keys
          .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
          .slice(0, keys.length - MAX_CACHE_SIZE)
          .forEach((key) => delete cache[key]);
      }

      chrome.storage.local.set({ linkStatusCache: cache });
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const link = entry.target;
        const hrefAttr = link.getAttribute('href');
        let absoluteHref;

        try {
          absoluteHref = new URL(hrefAttr, window.location.href).href;
        } catch {
          return;
        }

        if (seen.has(absoluteHref)) return;
        seen.add(absoluteHref);

        getCachedStatus(absoluteHref).then((cached) => {
          if (cached !== undefined) {
            if (typeof cached.status === 'number' && cached.status >= 400) {
              const icon =
                '<sup title="Link is broken" style="color:red; margin-left:4px;">&#10008;</sup>';
              link.insertAdjacentHTML('beforeend', icon);
            }
            return;
          }

          chrome.runtime.sendMessage(
            {
              type: 'validate',
              payload: { href: absoluteHref },
            },
            (response) => {
              const code = response.payload.statusCode;
              setCachedStatus(absoluteHref, code);

              if (typeof code === 'number' && code >= 400) {
                const icon =
                  '<sup title="Link is broken" style="color:red; margin-left:4px;">&#10008;</sup>';
                link.insertAdjacentHTML('beforeend', icon);
              }
            }
          );
        });
      }
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    }
  );

  for (const link of linkElements) {
    observer.observe(link);
  }
}
