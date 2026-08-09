/**
 * AipExtractor - Core AIP Document Extraction & Resolution Engine
 */
const AipExtractor = (() => {

  const AIP_CONFIGS = [
    {
      name: "Thailand",
      match: (url) => url.includes('caat.or.th'),
      filter: {
        include: ['sup', 'aic', 'amdt', 'amendment', 'pdf', 'aip', 'circular', 'supplement', 'airac'],
        exclude: ['eaip.css', 'images/', 'help']
      }
    },
    {
      name: "Hong Kong",
      match: (url) => url.includes('cad.gov.hk') || url.includes('hkaip') || url.includes('ais.gov.hk'),
      filter: {
        include: ['aip amdt', 'aip sup', 'aic', 'complete amendment', 'amendment', 'pdf Version'],
        exclude: ['eaip.css', 'images/', 'help']
      }
    },
    {
      name: "Taiwan",
      match: (url) => url.includes('caa.gov.tw'),
      filter: {
        include: ['sup', 'aic', 'amdt', 'amendment', 'pdf', 'aip', 'circular', 'supplement', 'airac'],
        exclude: ['eaip.css', 'images/', 'help']
      }
    },
    {
      name: "Local Files",
      match: (url) => url.startsWith('file://'),
      filter: {
        include: ['sup', 'aic', 'amdt', 'pdf', 'aip', 'circular', 'supplement'],
        exclude: ['images/']
      }
    },
    {
      name: "Default eAIP",
      match: () => true, // Fallback
      filter: {
        include: ['sup', 'aic', 'amdt', 'amendment', 'pdf', 'aip', 'circular', 'supplement', 'airac'],
        exclude: ['eaip.css', 'images/', 'help']
      }
    }
  ];

  /**
   * Helper to match configuration for a URL
   */
  function getConfigForUrl(url) {
    return AIP_CONFIGS.find(cfg => cfg.match(url)) || AIP_CONFIGS[AIP_CONFIGS.length - 1];
  }

  /**
   * Filters a raw list of scanned links using configuration-driven criteria
   */
  function filterAipLinks(pageUrl, links) {
    const config = getConfigForUrl(pageUrl);
    const seenUrls = new Set();
    let filtered = [];

    // Filter out non-http/https/file links
    links = links.filter(link => link.url && (
      link.url.toLowerCase().startsWith('http://') || 
      link.url.toLowerCase().startsWith('https://') || 
      link.url.toLowerCase().startsWith('file://')
    ));

    // 1. Try to find links matching config include/exclude patterns
    filtered = links.filter(link => {
      if (!link.url) return false;
      const lowerUrl = link.url.toLowerCase();
      const lowerText = link.text.toLowerCase().replace(/\s+/g, ' ');
      
      if (seenUrls.has(link.url)) return false;

      const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/');
      const isHtmlEaip = (lowerUrl.includes('eaip') || lowerUrl.includes('hkaip') || lowerUrl.includes('aip') || lowerUrl.includes('airac') || lowerUrl.includes('amdt')) && 
                         (lowerUrl.endsWith('.html') || lowerUrl.endsWith('/') || lowerUrl.includes('history') || lowerUrl.includes('index'));
      
      if (!isPdf && !isHtmlEaip) return false;

      // Exclude matches based on configuration
      const shouldExclude = config.filter.exclude.some(kw => lowerUrl.includes(kw));
      if (shouldExclude) return false;

      // Keep only links that match configured keywords
      const matchesKeyword = config.filter.include.some(kw => lowerUrl.includes(kw) || lowerText.includes(kw));
      if (!matchesKeyword) return false;

      seenUrls.add(link.url);
      return true;
    });

    // 2. Secondary heuristic if we found nothing: fall back to any PDF link on the page
    if (filtered.length === 0) {
      filtered = links.filter(link => {
        if (!link.url) return false;
        if (seenUrls.has(link.url)) return false;
        const lowerUrl = link.url.toLowerCase();
        const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/');
        if (isPdf) {
          seenUrls.add(link.url);
          return true;
        }
        return false;
      });
    }

    return filtered;
  }

  /**
   * Helper to parse alternate print PDF links out of an HTML string
   */
  function extractPrintPdfFromHtmlText(htmlText, baseUrl) {
    const linkTags = htmlText.match(/<link[^>]+>/gi) || [];
    for (const tag of linkTags) {
      const lowerTag = tag.toLowerCase();
      if (lowerTag.includes('type="application/pdf"') || lowerTag.includes("type='application/pdf'") ||
          (lowerTag.includes('rel="alternate"') && lowerTag.includes('.pdf'))) {
        const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
        if (hrefMatch) {
          return new URL(hrefMatch[1], baseUrl).href.replace(/\\/g, '/');
        }
      }
    }
    
    // Fallback: search for any PDF link inside the HTML text
    const pdfRegex = /href=["']([^"']+\.pdf(?:[^"']*)?)["']/gi;
    let pdfMatch = pdfRegex.exec(htmlText);
    if (pdfMatch) {
      return new URL(pdfMatch[1], baseUrl).href.replace(/\\/g, '/');
    }
    return null;
  }

  /**
   * Resolves a folder link or page link to its underlying PDF URL(s)
   */
  async function resolveAipHtmlToPdfLinks(link) {
    const lowerUrl = link.url.toLowerCase();
    const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/');
    
    if (isPdf) {
      return [link];
    }
    
    try {
      const res = await fetch(link.url);
      if (!res.ok) return [link];
      let htmlText = await res.text();
      let contextUrl = link.url;

      // Check if this page itself has an alternate print PDF (standalone document)
      const selfPrintPdf = extractPrintPdfFromHtmlText(htmlText, link.url);
      if (selfPrintPdf) {
        let docType = 'AMDT';
        const itemLowerUrl = selfPrintPdf.toLowerCase();
        const itemLowerText = link.text.toLowerCase();
        if (itemLowerUrl.includes('sup') || itemLowerUrl.includes('supplement') || itemLowerText.includes('sup') || itemLowerText.includes('supplement')) {
          docType = 'SUP';
        } else if (itemLowerUrl.includes('aic') || itemLowerUrl.includes('circular') || itemLowerText.includes('aic') || itemLowerText.includes('circular')) {
          docType = 'AIC';
        }

        // If the text is short or not descriptive, extract the title of the HTML page
        let text = link.text;
        if (text.length < 15 || text.toLowerCase().includes('click') || text.includes('..')) {
          const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(htmlText);
          if (titleMatch && titleMatch[1]) {
            text = titleMatch[1].trim().replace(/\s+/g, ' ');
          }
        }

        return [{
          url: selfPrintPdf,
          text: text,
          docType: docType
        }];
      }

      // Extract all frame src attributes
      const frameRegex = /<frame[^>]+src=["']([^"']+)["']/gi;
      let match;
      const frameSrcs = [];
      while ((match = frameRegex.exec(htmlText)) !== null) {
        frameSrcs.push(match[1]);
      }

      if (frameSrcs.length > 0) {
        // Find the frame that contains 'cover' in its src (most specific target)
        let coverSrc = frameSrcs.find(src => src.toLowerCase().includes('cover'));
        if (!coverSrc) {
          coverSrc = frameSrcs[frameSrcs.length - 1]; // Fallback to last frame
        }
        
        const absoluteCoverUrl = new URL(coverSrc, link.url).href.replace(/\\/g, '/');
        const coverRes = await fetch(absoluteCoverUrl);
        if (coverRes.ok) {
          htmlText = await coverRes.text();
          contextUrl = absoluteCoverUrl;
        }
      }

      // Now extract links from htmlText (which is either the page itself or the resolved cover frame)
      const parsedLinks = [];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = linkRegex.exec(htmlText)) !== null) {
        const href = match[1];
        const rawText = match[2];
        const text = rawText.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        const absoluteUrl = new URL(href, contextUrl).href.replace(/\\/g, '/');
        parsedLinks.push({ url: absoluteUrl, text: text });
      }

      // Filter extracted links
      const filtered = filterAipLinks(contextUrl, parsedLinks);

      // Map resolved links to include the correct docType based on keywords
      return filtered.map(item => {
        let docType = 'AMDT';
        const itemLowerUrl = item.url.toLowerCase();
        const itemLowerText = item.text.toLowerCase();
        if (itemLowerUrl.includes('sup') || itemLowerUrl.includes('supplement') || itemLowerText.includes('sup') || itemLowerText.includes('supplement')) {
          docType = 'SUP';
        } else if (itemLowerUrl.includes('aic') || itemLowerUrl.includes('circular') || itemLowerText.includes('aic') || itemLowerText.includes('circular')) {
          docType = 'AIC';
        }
        return {
          url: item.url,
          text: item.text,
          docType: docType
        };
      });

    } catch (e) {
      console.error("Error resolving HTML to PDF links:", link.url, e);
      return [link];
    }
  }

  return {
    filterAipLinks,
    resolveAipHtmlToPdfLinks,
    extractPrintPdfFromHtmlText
  };

})();
