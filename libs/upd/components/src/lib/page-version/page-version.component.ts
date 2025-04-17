import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  Signal,
  viewChild,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import { DropdownOption } from '../dropdown/dropdown.component';
import dayjs from 'dayjs';
import {
  Diff2HtmlUIConfig,
  Diff2HtmlUI,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { createPatch } from 'diff';
import { load, Cheerio, AnyNode } from 'cheerio/lib/slim';
import { Diff } from '@ali-tas/htmldiff-js';
import { RadioOption } from '../radio/radio.component';
import { I18nFacade } from '@dua-upd/upd/state';
import { FR_CA } from '@dua-upd/upd/i18n';
import { arrayToDictionary, isNullish } from '@dua-upd/utils-common';
import { UrlHash } from '@dua-upd/types-common';
interface DiffOptions {
  repeatingWordsAccuracy?: number;
  ignoreWhiteSpaceDifferences?: boolean;
  orphanMatchThreshold?: number;
  matchGranularity?: number;
  combineWords?: boolean;
}

interface MainConfig {
  outputFormat: 'side-by-side' | 'line-by-line';
  viewMode: { value: string; label: string; description: string };
}

interface PageConfig {
  before: UrlHash | null;
  after: UrlHash | null;
}

@Component({
  selector: 'upd-page-version',
  templateUrl: './page-version.component.html',
  styleUrls: ['./page-version.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PageVersionComponent {
  i18n = inject(I18nFacade);
  loading = input<boolean>(true);
  hashes = input<UrlHash[]>([]);
  url = input<string>('');
  shadowDOM = signal<ShadowRoot | null>(null);
  sourceContainer = viewChild<ElementRef<HTMLElement>>('sourceContainer');
  liveContainer = viewChild<ElementRef<HTMLElement>>('liveContainer');
  outputFormat = signal<'side-by-side' | 'line-by-line'>('side-by-side');
  viewMode = signal<RadioOption<string>>({
    label: 'Web page',
    value: 'live',
    description: 'View the live page',
  });
  before = signal<UrlHash | null>(null);
  after = signal<UrlHash | null>(null);

  currentLang = this.i18n.currentLang;
  dateParams = computed(() => {
    return this.currentLang() == FR_CA ? 'DD MMM YYYY' : 'MMM DD, YYYY';
  });

  dropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const hashes = this.hashes();
    const currentHash = hashes[0]?.hash;
    const lang = this.currentLang();

    return hashes.map(({ hash, date }) => {
      const formattedDate = dayjs(date).locale(lang).format(this.dateParams());
      const isCurrent = hash === currentHash;

      return {
        label: `${formattedDate} ${isCurrent ? `(${this.i18n.service.translate('Current', lang)})` : ''}`,
        value: hash,
      };
    });
  });

  beforeDropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const options = this.dropdownOptions();
    if (options.length < 2) return options;

    const selectedDate = this.versionConfig()?.after?.date;
    if (!selectedDate) return options.slice(1);

    const hashesDict = arrayToDictionary(this.hashes(), 'hash');

    const filteredOptions = options.filter(({ value }) => {
      const optionDate = value ? hashesDict[value]?.date : undefined;
      return optionDate && dayjs(optionDate).isBefore(dayjs(selectedDate));
    });

    return filteredOptions.length > 1 ? filteredOptions : options.slice(1);
  });

  afterDropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const options = this.dropdownOptions();

    const selectedDate = this.versionConfig()?.before?.date;
    if (!selectedDate) return options;

    const hashesDict = arrayToDictionary(this.hashes(), 'hash');

    return options?.filter(({ value }) => {
      const optionDate = value ? hashesDict[value].date : undefined;
      return optionDate && dayjs(optionDate).isAfter(dayjs(selectedDate));
    });
  });
  sourceFormatOptions: DropdownOption<string>[] = [
    { label: 'Side by side', value: 'side-by-side' },
    { label: 'Unified', value: 'line-by-line' },
  ];

  viewModeOptions: RadioOption<string>[] = [
    { label: 'Web page', value: 'live', description: '' },
    {
      label: 'Page source',
      value: 'source',
      description: '',
    },
  ];

  versionConfig = computed<PageConfig>(() => ({
    before: this.before(),
    after: this.after(),
  }));

  config = computed(() => ({
    outputFormat: this.outputFormat(),
    viewMode: this.viewMode(),
  }));

  elements = signal<string[]>([]);
  currentIndex = signal<number>(0);

  legendItems = signal<
    { text: string; colour: string; style: string; lineStyle?: string }[]
  >([
    { text: 'Previous version', colour: '#F3A59D', style: 'highlight' },
    { text: 'Updated version', colour: '#83d5a8', style: 'highlight' },
    { text: 'Updated link', colour: '#FFEE8C', style: 'highlight' },
    { text: 'Hidden content', colour: '#6F9FFF', style: 'line' },
    {
      text: 'Modal content',
      colour: '#666',
      style: 'line',
      lineStyle: 'dashed',
    },
    {
      text: 'Dynamic content',
      colour: '#fbc02f',
      style: 'line',
      lineStyle: 'dashed',
    },
  ]);

  constructor(private renderer: Renderer2) {
    effect(() => {
      const liveContainer = this.liveContainer()?.nativeElement;
      if (!liveContainer) return;

      const shadowDOM = this.shadowDOM()?.innerHTML;
      if (!shadowDOM) return;

      const diffViewer = liveContainer.querySelector(
        'diff-viewer',
      ) as HTMLElement;

      if (!diffViewer || !diffViewer.shadowRoot) return;

      this.renderer.listen(
        diffViewer.shadowRoot,
        'click',
        this.handleDocumentClick.bind(this),
      );
    });

    effect(
      () => {
        const storedConfig = this.getStoredConfig();
        if (storedConfig) {
          this.restoreConfig(storedConfig);
        } else {
          this.useDefaultSelection();
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const storedConfig = JSON.parse(
          sessionStorage.getItem(`main-version-config`) || 'null',
        );

        if (storedConfig) {
          this.restoreMainConfig(storedConfig);
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const container = this.sourceContainer();
        if (!container) return;

        this.createHtmlDiffContent(container);

        this.storeConfig();
      },
      { allowSignalWrites: true },
    );

    effect(
      async () => {
        const container = this.liveContainer();
        if (!container) return;

        try {
          const { liveDiffs, leftBlobContent } =
            await this.createLiveDiffContent();
          this.renderLiveDifferences(liveDiffs, leftBlobContent);
          this.storeConfig();
        } catch (error) {
          console.error('Error in live diff effect:', error);
        }
      },
      { allowSignalWrites: true },
    );
  }
  private handleDocumentClick(event: MouseEvent): void {
    const liveContainer = this.liveContainer()?.nativeElement;
    if (!liveContainer) return;

    const diffViewer = liveContainer.querySelector(
      'diff-viewer',
    ) as HTMLElement;
    if (!diffViewer || !diffViewer.shadowRoot) return;

    let target = event.target as HTMLElement;
    while (target && target.tagName !== 'A') {
      target = target.parentElement as HTMLElement;
    }

    if (
      target?.tagName === 'A' &&
      target.getAttribute('href')?.startsWith('#')
    ) {
      event.preventDefault();
      const sectionId = target.getAttribute('href')?.substring(1);
      const targetSection = diffViewer.shadowRoot?.getElementById(
        sectionId ?? '',
      );

      if (targetSection) {
        targetSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    } else {
      const changeElements = Array.from(
        diffViewer.shadowRoot.querySelectorAll<HTMLElement>('[data-id]'),
      );

      if (!changeElements.length) return;

      const clickedElement = changeElements.find((el) =>
        el.contains(event.target as Node),
      );

      if (!clickedElement) return;
      const index = Number(clickedElement.getAttribute('data-id'));
      this.scrollToElement(index);
    }
  }
  private getStoredConfig(): PageConfig | null {
    const currentUrl = this.url();
    return currentUrl
      ? JSON.parse(
          sessionStorage.getItem(`${currentUrl}-version-config`) || 'null',
        )
      : null;
  }

  private storeConfig(): void {
    const currentUrl = this.url();
    sessionStorage.setItem(
      `${currentUrl}-version-config`,
      JSON.stringify(this.versionConfig()),
    );
  }

  private createHtmlDiffContent(container: ElementRef<HTMLElement>) {
    const leftBlob = this.before()?.blob || '';
    const rightBlob = this.after()?.blob || '';

    const patch = createPatch('', leftBlob, rightBlob, '', '');
    const diffOptions: Diff2HtmlUIConfig = {
      outputFormat: this.outputFormat(),
      drawFileList: false,
      fileContentToggle: false,
      matching: 'words',
    };

    const diff2 = new Diff2HtmlUI(container.nativeElement, patch, diffOptions);
    diff2.draw();
  }

  private async renderLiveDifferences(
    differences: string,
    before: string,
  ): Promise<void> {
    const liveContainer = this.liveContainer();
    if (!liveContainer) return;

    let element = liveContainer.nativeElement.querySelector('diff-viewer');
    if (!element) {
      element = document.createElement('diff-viewer');
      liveContainer.nativeElement.appendChild(element);
    }

    const shadowDOM =
      element.shadowRoot || element.attachShadow({ mode: 'open' });

    const parser = new DOMParser();
    const sanitizedUnifiedContent = parser.parseFromString(
      differences,
      'text/html',
    ).body.innerHTML;

    shadowDOM.innerHTML = `
      <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css" />
      <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css" />
      <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2024-09-kejimkujik.min.css" crossorigin="anonymous" integrity="sha384-G6/REI+fqg3y/BLFAY+CvJtr+5uK4A96h1v5fIJAmeHqbJdCOE99tmE6CeicCHQv" />
      <style>
        .cnjnctn-type-or>[class*=cnjnctn-col]:not(:first-child):before {
          content: "or";
        }

        ins,
        del,
        .updated-link {
          display: inline-block;
          padding: 0 .3em;
          height: auto;
          border-radius: .3em;
          display: inline;
          -webkit-box-decoration-break: clone;
          -o-box-decoration-break: clone;
          box-decoration-break: clone;
          margin-left: .07em;
          margin-right: .07em;
        }

        ins {
          background: #83d5a8;
          text-decoration: none;
        }

        del {
          background: #F3A59D;
          text-decoration: strikethrough;
        }

        .overlay-wrapper {
          position: relative;
          display: inline-block;
          width: 100%;
          height: 100%;
        }

        .overlay-wrapper::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(131, 213, 168, 0.4);
          z-index: 10;
          border-radius: 5px;
          pointer-events: none;
        }

        .overlay-wrapper.del::before {
          background: rgba(243, 165, 157, 0.5);
        }

        .overlay-wrapper.del::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 2px;
          background: rgba(24, 21, 21, 0.5);
          z-index: 20;
          pointer-events: none;
          opacity: 0.8;
        }

        .overlay-wrapper img {
          width: 100%;
          display: block;
        }

        .overlay-wrapper.updated-link::before {
          background: rgba(250, 237, 165, 0.23);
        }

        .overlay-wrapper.highlight::before {
          border: 2px dotted #000;
        }

        .updated-link {
          background-color: #FFEE8C;
        }

        del.highlight,
        ins.highlight,
        .updated-link.highlight:not(.overlay-wrapper.updated-link) {
          border: #000 2px dotted;
          display: inline;
          padding: 0 .35em 0em 0.35em;
          line-height: unset;
          position: unset;
          top: unset;
          height: unset;
          transition: padding-left ease .3s, padding-right ease .3s, color ease .7s;
        }
      </style>
      <div class="diff-container">
        <div>${sanitizedUnifiedContent}</div>
      </div>
    `;

    await this.adjustDOM(shadowDOM, before);
  }

  private async adjustDOM(shadowDOM: ShadowRoot, before: string) {
    interface LinkData {
      text: string;
      href: string;
      insText: string;
      element: Cheerio<AnyNode>;
    }

    type LinksMap = Map<string, LinkData[]>;

    const $ = load(shadowDOM.innerHTML);
    const $before = load(before);
    const newLinks: LinksMap = new Map();

    const cleanText = (text: string) => text?.trim().replace(/\s+/g, ' ') || '';

    const wrapWithSpan = ($el: Cheerio<AnyNode>, title: string) =>
      `<span class="updated-link" title="${title}">${$.html($el)}</span>`;

    const findMatchingLinks = (beforeText: string) =>
      newLinks.get(beforeText) ||
      [...newLinks.values()]
        .flat()
        .filter(({ insText }) => insText === beforeText);

    for (const el of $('a').toArray()) {
      const $el = $(el);
      const text = cleanText($el.text());
      const href = $el.attr('href');
      if (!text || !href) continue;

      newLinks.set(text, newLinks.get(text) || []);
      newLinks.get(text)?.push({
        text,
        insText:
          cleanText($el.contents().not('ins').text()) ||
          cleanText($el.contents().children().not('ins').text()),
        href,
        element: $el,
      });
    }

    for (const el of $before('a').toArray()) {
      const $el = $before(el);
      const text = cleanText($el.text());
      const href = $el.attr('href');
      if (!text || !href) continue;

      const matches = findMatchingLinks(text);
      if (!matches.length) continue;

      const matchingKey = [...newLinks.keys()].find((key) =>
        newLinks.get(key)?.some(({ insText }) => insText === text),
      );
      if (matchingKey) newLinks.delete(matchingKey);

      if (matches.some(({ href: matchHref }) => matchHref === href)) {
        newLinks.delete(text);
        continue;
      }

      if (
        matches
          .find(({ element }) => element.is('del'))
          ?.element.text()
          .trim() === text ||
        matches
          .find(({ element }) => element.children().is('ins'))
          ?.element.text()
          .trim() === text
      ) {
        newLinks.delete(text);
        continue;
      }

      for (const { insText, element } of matches) {
        if (insText)
          element.replaceWith(wrapWithSpan(element, `Old URL: ${href}`));
      }
      newLinks.delete(text);
    }

    for (const links of newLinks.values()) {
      for (const { element, insText } of links) {
        if (insText)
          element.replaceWith(wrapWithSpan(element, 'Newly added link'));
      }
    }

    $('del>del, ins>ins').each((index, element) => {
      const $element = $(element);
      const parent = $element.parent();
      if (parent.text().trim() === $element.text().trim()) {
        parent.replaceWith($element);
      }
    });

    $('del>ins, ins>del').each((index, element) => {
      const $element = $(element);
      const parentText = $element.parent();
      const childText = $element.text();
      if (parentText.text().trim() === childText.trim()) {
        parentText.replaceWith($element);
      }
    });

    shadowDOM.innerHTML = $.html();

    const uniqueElements = $('ins, del, .updated-link')
      .map((_, element) => {
        const $element = $(element);
        return {
          element: $element,
          outerHTML: $element.parent()?.html()?.replace(/\n/g, '').trim() || '',
        };
      })
      .toArray();

    uniqueElements.forEach(({ element }, index) => {
      element.attr('data-id', `${index + 1}`);
    });

    const wrapWithOverlayWrapper = (
      $el: Cheerio<AnyNode>,
      parentClass: string,
    ) => {
      const parent = $el.parent();
      const dataId = parent.attr('data-id');

      return parent.replaceWith(
        `<div class="overlay-wrapper ${parentClass}" ${dataId ? `data-id="${dataId}"` : ''}>${$.html($el)}</div>`,
      );
    };

    $('ins img, del img, .updated-link img').each((_, element) => {
      const $element = $(element);
      const parent = $element.parent();

      let parentClass = '';
      if (parent.is('ins')) parentClass = 'ins';
      else if (parent.is('del')) parentClass = 'del';

      if (parentClass) {
        const wrappedElement = wrapWithOverlayWrapper($element, parentClass);
        if (wrappedElement) {
          $element.replaceWith(wrappedElement);
        }
      }
    });

    shadowDOM.innerHTML = $.html();

    this.elements.set(uniqueElements.map(({ outerHTML }) => outerHTML));
    this.currentIndex.set(0);
    this.shadowDOM.set(shadowDOM);
  }

  private async extractContent(html: string): Promise<string> {
    const $ = load(html);
    const baseUrl = 'https://www.canada.ca';

    const fetchUrl = async (
      url: string,
      type: 'json' | 'text',
    ): Promise<any> => {
      try {
        const response = await fetch(url);
        return type === 'json' ? response.json() : response.text();
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error);
        return type === 'json' ? {} : '';
      }
    };

    const processAjaxReplacements = async () => {
      const processElements = async () => {
        const ajaxElements = $(
          '[data-ajax-replace^="/"], [data-ajax-after^="/"], [data-ajax-append^="/"], [data-ajax-before^="/"], [data-ajax-prepend^="/"]',
        ).toArray();
        if (!ajaxElements.length) return;

        for (const element of ajaxElements) {
          const $el = $(element);
          const tag = $el.prop('tagName').toLowerCase();
          const attributes = $el.attr();

          for (const [attr, ajaxUrl] of Object.entries(attributes || {})) {
            if (!attr.startsWith('data-ajax-') || !ajaxUrl.startsWith('/'))
              continue;

            const [url, anchor] = ajaxUrl.split('#');
            const fullUrl = `${baseUrl}${url}`;
            const $ajaxContent = load(await fetchUrl(fullUrl, 'text'));

            const content = anchor
              ? $ajaxContent(`#${anchor}`)
                  .map((_, e) => $(e))
                  .toArray()
                  .join('')
              : $ajaxContent.html();

            if (!content) continue;

            const styledContent = `
              <div style="border: 3px dashed #fbc02f; padding: 8px; border-radius: 4px;"> <${tag}>${content}</${tag}> </div>
            `;

            $el.replaceWith(styledContent);
          }
        }
      };

      let previousCount;
      let currentCount = 0;

      do {
        previousCount = currentCount;
        await processElements();
        currentCount = $(
          '[data-ajax-replace^="/"], [data-ajax-after^="/"], [data-ajax-append^="/"], [data-ajax-before^="/"], [data-ajax-prepend^="/"]',
        ).length;
      } while (currentCount && currentCount !== previousCount);
    };

    const processJsonReplacements = async () => {
      const jsonElements = $('[data-wb-jsonmanager]').toArray();
      if (!jsonElements.length) return;

      const jsonDataMap = new Map<string, any>();

      await Promise.all(
        jsonElements.map(async (element) => {
          const jsonConfig = parseJsonConfig(
            $(element).attr('data-wb-jsonmanager') || '',
          );
          if (!jsonConfig?.['url'] || !jsonConfig?.['name']) return;

          const { url, jsonKey } = parseJsonUrl(jsonConfig['url']);
          const fullUrl = `${baseUrl}${url}`;

          try {
            const jsonData = await fetchUrl(fullUrl, 'json');
            const content = resolveJsonPath(jsonData, jsonKey);

            jsonDataMap.set(jsonConfig['name'], content);
          } catch (error) {
            console.error(
              `Error fetching JSON for ${jsonConfig['name']}:`,
              error,
            );
          }
        }),
      );

      $('[data-json-replace]').each((_, element) => {
        const replacePath = $(element).attr('data-json-replace') || '';
        const match = replacePath.match(/^#\[(.*?)\](.*)$/);
        if (!match) return;

        const jsonName = match[1];
        const jsonPath = match[2].substring(1);

        if (!jsonDataMap.has(jsonName)) {
          console.warn(`No JSON data found for: ${jsonName}`);
          return;
        }

        const jsonData = jsonDataMap.get(jsonName);
        const content = resolveJsonPath(jsonData, jsonPath);

        const styledContent = `
          <div style="
            border: 3px dashed #fbc02f;
            padding: 8px;
            border-radius: 4px;
          "> 
            ${content} 
          </div>
        `;

        $(element).replaceWith(styledContent);
      });
    };

    const parseJsonUrl = (url: string): { url: string; jsonKey: string } => {
      const [baseUrl, jsonKey = ''] = url.split('#');
      return { url: baseUrl, jsonKey: jsonKey.slice(1) };
    };

    const parseJsonConfig = (config: string): Record<string, any> | null => {
      try {
        return JSON.parse(config.replace(/&quot;/g, '"'));
      } catch (error) {
        console.error('Error parsing JSON config:', error);
        return null;
      }
    };

    const resolveJsonPath = (obj: any, path: string): any => {
      return path
        .split('/')
        .reduce(
          (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
          obj,
        );
    };

    const processModalDialogs = () => {
      $('.modal-dialog.modal-content').each((index, element) => {
        const $el = $(element);
        const currentContent = $el.html();
        const id = $el.attr('id');

        const styledContent = `
        <div style="border: 2px dashed #666;"> ${currentContent || ''} </div>
      `;

        $el.html(styledContent).removeClass('mfp-hide');
      });
    };

    const updateRelativeURLs = () => {
      $('a, img').each((index, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const src = $el.attr('src');

        if (href) {
          if (href.startsWith('/')) {
            $el.attr('href', `${baseUrl}${href}`).attr('target', '_blank');
          } else if (/^(http|https):\/\//.test(href)) {
            $el.attr('target', '_blank');
          }
        }

        if (src && src.startsWith('/')) {
          $el.attr('src', `${baseUrl}${src}`);
        }
      });
    };

    const cleanupUnnecessaryElements = () => {
      $('section#chat-bottom-bar').remove();
    };

    const displayInvisibleElements = () => {
      // .hidden and .nojs-show also?
      $('.wb-inv').each((index, element) => {
        const $el = $(element);
        $el.css({
          border: '2px solid #6F9FFF',
        });
        $el.removeClass('wb-inv');
      });
    };

    const addToc = () => {
      const $tocSection = $('.section.mwsinpagetoc');
      if (!$tocSection.length) return;

      const tocLinks = $tocSection
        .find('a')
        .map((_, link) => {
          const $link = $(link);
          const href = $link.attr('href');
          return href?.startsWith('#')
            ? { id: href.slice(1), text: $link.text().trim() }
            : null;
        })
        .get();

      if (!tocLinks.length) return;

      $('h2, h3, h4, h5, h6').each((_, heading) => {
        const $heading = $(heading);
        const matchedLink = tocLinks.find(
          (link) => link.text === $heading.text().trim(),
        );
        if (matchedLink) $heading.attr('id', matchedLink.id);
      });
    };

    await processAjaxReplacements();
    await processJsonReplacements();
    processModalDialogs();
    updateRelativeURLs();
    cleanupUnnecessaryElements();
    displayInvisibleElements();
    addToc();

    return $('main').html() || '';
  }

  private async createLiveDiffContent(): Promise<{
    liveDiffs: string;
    leftBlobContent: string;
  }> {
    const leftBlob = this.before()?.blob || '';
    const rightBlob = this.after()?.blob || '';

    const leftBlobContent = await this.extractContent(leftBlob);
    const rightBlobContent = await this.extractContent(rightBlob);

    const options: DiffOptions = {
      repeatingWordsAccuracy: 0,
      ignoreWhiteSpaceDifferences: false,
      orphanMatchThreshold: 0,
      matchGranularity: 4,
      combineWords: true,
    };

    const liveDiffs = Diff.execute(
      leftBlobContent,
      rightBlobContent,
      options,
    ).replace(
      /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis,
      ' ',
    );

    return { liveDiffs, leftBlobContent };
  }

  next() {
    const elementsArray = this.elements();
    const currentIndex = this.currentIndex();
    const newIndex =
      currentIndex === elementsArray.length ? 1 : currentIndex + 1;
    this.scrollToElement(newIndex);
  }

  prev() {
    const elementsArray = this.elements();
    const currentIndex = this.currentIndex();
    const newIndex =
      currentIndex === 1 || currentIndex === 0
        ? elementsArray.length
        : currentIndex - 1;
    this.scrollToElement(newIndex);
  }
  private scrollToElement(index: number): void {
    const shadowDOM = this.shadowDOM();
    if (!shadowDOM) return;

    const $ = load(shadowDOM.innerHTML);

    const targetElement = $(`[data-id="${index}"]`);
    if (!targetElement.length) return;

    $('.highlight').removeClass('highlight');

    $('details[open]').each((index, element) => {
      const $element = $(element);
      if (!$element.is(targetElement.closest('details'))) {
        $element.removeAttr('open');
      }
    });

    let parentDetails = targetElement.closest('details');
    while (parentDetails.length) {
      if (!parentDetails.attr('open')) {
        parentDetails.attr('open', '');
      }
      parentDetails = parentDetails.parent().closest('details');
    }

    targetElement.addClass('highlight');

    shadowDOM.innerHTML = $.html();

    const domTargetElement = shadowDOM.querySelector(`[data-id="${index}"]`);
    if (domTargetElement) {
      domTargetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    this.currentIndex.set(index);
  }

  updateSelection(
    option: DropdownOption<string>,
    side: 'left' | 'right',
  ): void {
    if (!this.hashes()) return;

    const versionIndex = this.hashes().findIndex(
      (h) => h.hash === option.value,
    );
    const version = versionIndex !== -1 ? this.hashes()[versionIndex] : null;

    const dateOptionIndex = (
      side === 'left'
        ? this.beforeDropdownOptions()
        : this.afterDropdownOptions()
    ).findIndex((opt) => opt.value === option.value);

    if (side === 'left') {
      this.before.set(version);
      this.selectedBeforeIndex.set(
        dateOptionIndex !== -1 ? dateOptionIndex : null,
      );
    } else {
      this.after.set(version);
      this.selectedAfterIndex.set(
        dateOptionIndex !== -1 ? dateOptionIndex : null,
      );
    }
  }

  private restoreConfig(config: PageConfig): void {
    if (config.before) this.before.set(config.before);
    if (config.after) this.after.set(config.after);
  }

  private restoreMainConfig(config: MainConfig): void {
    if (config.outputFormat) this.outputFormat.set(config.outputFormat);
    if (config.viewMode) this.viewMode.set(config.viewMode);
  }

  private useDefaultSelection(): void {
    const [first, second] = this.hashes();
    if (first && second) {
      this.before.set(second);
      this.after.set(first);
    }
  }

  changeOutputFormat(format: string) {
    this.outputFormat.set(format as 'side-by-side' | 'line-by-line');
    sessionStorage.setItem(
      `main-version-config`,
      JSON.stringify(this.config()),
    );
  }

  changeViewMode(mode: { value: string; label: string; description: string }) {
    this.viewMode.set(mode);
    sessionStorage.setItem(
      `main-version-config`,
      JSON.stringify(this.config()),
    );
  }

  selectedBeforeIndex: WritableSignal<number | null> = signal(null);
  selectedAfterIndex: WritableSignal<number | null> = signal(null);
  selectedDate = (
    side: 'left' | 'right',
  ): Signal<DropdownOption<string> | null> =>
    computed(() => {
      if (!this.before() || !this.after()) return null;

      const currentHash =
        side === 'left' ? this.before()?.hash : this.after()?.hash;
      const availableOptions = this.dropdownOptions();

      const index = availableOptions.findIndex(
        (option) => option.value === currentHash,
      );

      if (availableOptions.length === 0 || !this.hashes() || !this.url())
        return null;

      return isNullish(index) || index === -1
        ? availableOptions[0]
        : availableOptions[index];
    });

  getInitialSelectionView = () =>
    computed(() => {
      const currentView = this.viewMode()?.value;
      const viewModeOptions = this.viewModeOptions;

      if (viewModeOptions.some((option) => option.value === currentView)) {
        return currentView;
      }

      return viewModeOptions.length > 0 ? viewModeOptions[0].value : '';
    });
}
