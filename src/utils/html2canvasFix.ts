import html2canvas from 'html2canvas';

// Shared color cache & offscreen dummy element to resolve CSS colors natively
const colorCache = new Map<string, string>();
let sharedDummyEl: HTMLDivElement | null = null;

/**
 * Resolves modern CSS colors (oklch, oklab, color-mix, lab, lch) to standard RGB/RGBA strings
 * using browser native computed style.
 */
export function resolveColorToRgb(colorStr: string): string {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  if (
    !colorStr.includes('oklch') &&
    !colorStr.includes('oklab') &&
    !colorStr.includes('color-mix') &&
    !colorStr.includes('lab') &&
    !colorStr.includes('lch')
  ) {
    return colorStr;
  }

  if (colorCache.has(colorStr)) {
    return colorCache.get(colorStr)!;
  }

  try {
    if (!sharedDummyEl) {
      sharedDummyEl = document.createElement('div');
      sharedDummyEl.style.display = 'none';
      sharedDummyEl.style.position = 'absolute';
      sharedDummyEl.style.pointerEvents = 'none';
      document.body.appendChild(sharedDummyEl);
    }
    sharedDummyEl.style.color = colorStr;
    const computed = window.getComputedStyle(sharedDummyEl).color;
    if (computed && (computed.startsWith('rgb') || computed.startsWith('#'))) {
      colorCache.set(colorStr, computed);
      return computed;
    }
  } catch (e) {
    // Ignore fallback errors
  }
  return 'rgb(15, 23, 42)';
}

function replaceModernColors(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (
    !str.includes('oklch') &&
    !str.includes('oklab') &&
    !str.includes('color-mix') &&
    !str.includes('lab') &&
    !str.includes('lch')
  ) {
    return str;
  }
  return str.replace(
    /(?:oklch|oklab|lab|lch|color-mix)\s*\((?:[^()]+|\([^()]*\))*\)/gi,
    (match) => resolveColorToRgb(match)
  );
}

/**
 * Sanitizes stylesheet rules and style tags in cloned documents so html2canvas doesn't crash on oklch.
 */
export function prepareClonedDocForHtml2Canvas(clonedDoc: Document): void {
  try {
    // 1. Sanitize style tags
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent) {
        styleTag.textContent = replaceModernColors(styleTag.textContent);
      }
    });

    // 2. Sanitize document style sheets if accessible
    try {
      const sheets = Array.from(clonedDoc.styleSheets);
      sheets.forEach((sheet) => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach((rule) => {
            if (rule instanceof CSSStyleRule && rule.cssText) {
              if (
                rule.cssText.includes('oklch') ||
                rule.cssText.includes('oklab') ||
                rule.cssText.includes('color-mix') ||
                rule.cssText.includes('lab') ||
                rule.cssText.includes('lch')
              ) {
                const style = rule.style;
                for (let i = 0; i < style.length; i++) {
                  const prop = style[i];
                  const val = style.getPropertyValue(prop);
                  if (
                    val &&
                    (val.includes('oklch') ||
                      val.includes('oklab') ||
                      val.includes('color-mix') ||
                      val.includes('lab') ||
                      val.includes('lch'))
                  ) {
                    style.setProperty(prop, replaceModernColors(val));
                  }
                }
              }
            }
          });
        } catch (e) {}
      });
    } catch (e) {}

    // 3. Sanitize element inline style attributes
    const allElements = clonedDoc.querySelectorAll('*');
    allElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const inlineStyle = el.getAttribute('style');
        if (
          inlineStyle &&
          (inlineStyle.includes('oklch') ||
            inlineStyle.includes('oklab') ||
            inlineStyle.includes('color-mix') ||
            inlineStyle.includes('lab') ||
            inlineStyle.includes('lch'))
        ) {
          el.setAttribute('style', replaceModernColors(inlineStyle));
        }

        // Font family consistency for Arabic
        el.style.fontFamily = "'Cairo', Tahoma, sans-serif";

        // Remove problematic effects that distort html2canvas
        const style = el.style;
        if (style) {
          if (style.backdropFilter) style.backdropFilter = 'none';
          if (style.filter) style.filter = 'none';
          if ((style as any).webkitBackdropFilter) (style as any).webkitBackdropFilter = 'none';
          if (style.transition) style.transition = 'none';
          if (style.animation) style.animation = 'none';
        }
      }
    });
  } catch (e) {
    console.error('Error in prepareClonedDocForHtml2Canvas:', e);
  }
}

/**
 * Synchronizes computed visual styles (colors, fonts, borders) from the source live DOM element
 * to the cloned element in html2canvas iframe.
 */
export function syncComputedStyles(sourceEl: HTMLElement, targetEl: HTMLElement): void {
  try {
    const sourceNodes = Array.from(sourceEl.querySelectorAll('*'));
    const targetNodes = Array.from(targetEl.querySelectorAll('*'));

    sourceNodes.unshift(sourceEl);
    targetNodes.unshift(targetEl);

    const len = Math.min(sourceNodes.length, targetNodes.length);
    for (let i = 0; i < len; i++) {
      const sNode = sourceNodes[i];
      const tNode = targetNodes[i];

      if (sNode instanceof HTMLElement && tNode instanceof HTMLElement) {
        const computed = window.getComputedStyle(sNode);

        // Copy exact computed colors (already resolved to RGB by browser)
        if (
          computed.backgroundColor &&
          computed.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          computed.backgroundColor !== 'transparent'
        ) {
          tNode.style.backgroundColor = computed.backgroundColor;
        }
        if (computed.color) {
          tNode.style.color = computed.color;
        }
        if (computed.borderColor) {
          tNode.style.borderColor = computed.borderColor;
        }
        if (computed.fill && computed.fill !== 'none') {
          tNode.style.fill = computed.fill;
        }
        if (computed.stroke && computed.stroke !== 'none') {
          tNode.style.stroke = computed.stroke;
        }

        // Font and text formatting
        tNode.style.fontFamily = "'Cairo', Tahoma, sans-serif";
        tNode.style.letterSpacing = 'normal';
        tNode.style.wordSpacing = 'normal';

        // Border preservation
        if (computed.borderWidth && computed.borderWidth !== '0px') {
          tNode.style.borderStyle = computed.borderStyle || 'solid';
          tNode.style.borderWidth = computed.borderWidth;
        }

        // Image fit preservation
        if (tNode.tagName === 'IMG') {
          tNode.style.objectFit = computed.objectFit || 'contain';
        }

        // Disable animations and filters that distort canvas
        tNode.style.backdropFilter = 'none';
        tNode.style.filter = 'none';
        (tNode.style as any).webkitBackdropFilter = 'none';
        tNode.style.transition = 'none';
        tNode.style.animation = 'none';
      }
    }
  } catch (e) {
    console.error('Error in syncComputedStyles:', e);
  }
}

/**
 * A wrapper for html2canvas that ensures pristine rendering and exact color reproduction.
 */
export async function safeHtml2canvas(element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> {
  const tempId = 'h2c-' + Math.random().toString(36).substring(2, 9);
  const prevAttr = element.getAttribute('data-h2c-target-id');
  element.setAttribute('data-h2c-target-id', tempId);

  try {
    const canvas = await html2canvas(element, {
      scale: options.scale || 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: options.backgroundColor || '#ffffff',
      imageTimeout: 15000,
      width: options.width,
      height: options.height,
      windowWidth: options.windowWidth,
      windowHeight: options.windowHeight,
      onclone: (clonedDoc) => {
        prepareClonedDocForHtml2Canvas(clonedDoc);

        const clonedTarget = clonedDoc.querySelector(`[data-h2c-target-id="${tempId}"]`) as HTMLElement;

        if (clonedTarget) {
          clonedTarget.style.position = 'relative';
          clonedTarget.style.top = '0';
          clonedTarget.style.left = '0';
          clonedTarget.style.opacity = '1';
          clonedTarget.style.visibility = 'visible';
          clonedTarget.style.display = 'block';
          clonedTarget.style.backgroundColor = '#ffffff';
          clonedTarget.style.margin = '0 auto';

          syncComputedStyles(element, clonedTarget);
        }

        if (options.onclone) {
          try {
            options.onclone(clonedDoc);
          } catch (e) {
            console.error('Error in custom onclone:', e);
          }
        }
      },
    });
    return canvas;
  } catch (error) {
    console.warn('safeHtml2canvas primary attempt had an issue, running simplified fallback:', error);
    return await html2canvas(element, {
      scale: options.scale || 1.5,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: options.backgroundColor || '#ffffff',
      imageTimeout: 20000,
      onclone: (clonedDoc) => {
        prepareClonedDocForHtml2Canvas(clonedDoc);
      },
    });
  } finally {
    if (prevAttr !== null) {
      element.setAttribute('data-h2c-target-id', prevAttr);
    } else {
      element.removeAttribute('data-h2c-target-id');
    }
  }
}


