'use strict';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'validate') {
    let href = request.payload.href;

    (async () => {
      if (!href || href.startsWith('javascript:')) {
        sendResponse({ payload: { statusCode: 400 } });
        return;
      }

      if (
        href.startsWith('#') ||
        href.startsWith('data:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        sendResponse({ payload: { statusCode: 200 } });
        return;
      }

      try {
        const response = await fetch(href, {
          method: 'GET',
          headers: {
            Range: 'bytes=0-0',
          },
          redirect: 'follow',
        });
        sendResponse({ payload: { statusCode: response.status } });
      } catch (error) {
        console.warn(`Error fetching ${href}:`, error);
        sendResponse({ payload: { statusCode: 'Error' } });
      }
    })();

    return true;
  }
});
