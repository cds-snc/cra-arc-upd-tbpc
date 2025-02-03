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
import { arrayToDictionary } from '@dua-upd/utils-common';
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
  before: HashSelection | null;
  after: HashSelection | null;
}

interface HashSelection {
  hash: string;
  date: Date;
  blob: string;
}

@Component({
  selector: 'upd-page-version',
  templateUrl: './page-version.component.html',
  styleUrls: ['./page-version.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PageVersionComponent {
  i18n = inject(I18nFacade);
  hashes = input<HashSelection[]>([]);
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
  before = signal<HashSelection | null>(null);
  after = signal<HashSelection | null>(null);

  currentLang = this.i18n.currentLang;
  dateParams = computed(() => {
    return this.currentLang() == FR_CA ? 'DD MMM YYYY' : 'MMM DD, YYYY';
  });

  dropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const hashes = this.hashes();
    const currentHash = hashes[0]?.hash;

    return hashes.map(({ hash, date }) => ({
      label: `${dayjs(date).format(this.dateParams())}${hash === currentHash ? ' (Current)' : ''}`,
      value: hash,
    }));
  });

  beforeDropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const options = this.dropdownOptions();
    const selectedHash = this.versionConfig()?.after?.hash;

    if (!selectedHash) return options;

    const selectedDate = this.versionConfig()?.after?.date;
    if (!selectedDate) return options;

    const hashesDict = arrayToDictionary(this.hashes(), 'hash');

    return options.filter(({ value }) => {
      const optionDate = value ? hashesDict[value].date : undefined;
      return optionDate && dayjs(optionDate).isBefore(dayjs(selectedDate));
    });
  });
  afterDropdownOptions: Signal<DropdownOption<string>[]> = computed(() => {
    const options = this.dropdownOptions();
    const selectedHash = this.versionConfig()?.before?.hash;

    if (!selectedHash) return options;

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
      const sectionId = target.getAttribute('href')?.substring(1); // Extract ID (removes the #)
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

    //     ${fontAwesomeCss() || ''}
    // ${wetBoewCss() || ''}
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

        .updated-link {
          background-color: #FFEE8C;
        }

        del.highlight,
        ins.highlight,
        .updated-link.highlight {
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
    const $ = load(shadowDOM.innerHTML);
    const $before = load(before);

    const newLinks = new Map<
      string,
      { href: string; element: Cheerio<AnyNode> }[]
    >();

    $('a').each((_, el) => {
      const $el = $(el);
      const text = $el.contents().not('ins').text().trim();
      const href = $el.attr('href');

      if (!text || !href) return;

      if (!newLinks.has(text)) {
        newLinks.set(text, []);
      }
      newLinks.get(text)?.push({ href, element: $el });
    });

    $before('a').each((_, el) => {
      const $beforeEl = $before(el);
      const beforeHref = $beforeEl.attr('href');
      const beforeText = $beforeEl.text().trim();

      const matches = newLinks.get(beforeText);

      if (!matches || matches.some(({ href }) => href === beforeHref)) return;

      const $del = matches.find(({ element }) => element.is('del'))?.element;
      if ($del && $del.text().trim() === beforeText) {
        return;
      }

      matches.forEach(({ element }) => {
        const oldHref = element.attr('href');
        element.replaceWith(`
          <span class="updated-link" title="Old URL: ${beforeHref || oldHref}">
            ${element}
          </span>
        `);
      });
    });

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
      .toArray()
      .map((element) => {
        const $element = $(element);
        const parent = $element.parent();

        const outerHTML = parent?.html()?.replace(/\n/g, '').trim() || '';

        return { element: $element, outerHTML };
      });
    // .filter(({ normalizedContent, contentOnly }) => {
    //   if (!normalizedContent || !contentOnly || seen.has(contentOnly)) {
    //     return false;
    //   }
    //   seen.add(contentOnly);
    //   return true;
    // });

    uniqueElements.forEach(({ element }, index) => {
      element.attr('data-id', `${index + 1}`); // Start from 1 instead of 0
    });

    shadowDOM.innerHTML = $.html();

    this.elements.set(uniqueElements.map(({ outerHTML }) => outerHTML));
    this.currentIndex.set(0);
    this.shadowDOM.set(shadowDOM);
  }

  private async extractContent(html: string): Promise<string> {
    const $ = load(html);
    const baseUrl = 'https://www.canada.ca';

    /**
     * Fetches content from a URL and returns it.
     */
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

      // Fetch JSON data
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

        // Styled output
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

    // Parse JSON Config safely
    const parseJsonConfig = (config: string): Record<string, any> | null => {
      try {
        return JSON.parse(config.replace(/&quot;/g, '"'));
      } catch (error) {
        console.error('Error parsing JSON config:', error);
        return null;
      }
    };

    // Resolve JSON path safely
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

    /**
     * Updates relative URLs for `<a>` and `<img>` elements to be absolute and opens links in a new tab.
     */
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

    // const updateFootnotes = () => {
    //   $('a[href^="#"]').each((index, element) => {
    //     const $el = $(element);
    //     const href = $el.attr('href');

    //     if (href) {
    //       $el.attr('href', `${href}`);
    //     }
    //   });
    // };

    /**
     * Removes unnecessary elements like the chat bottom bar.
     */
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

    // Execute the processing steps
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

  updateSelection(hash: string, side: 'left' | 'right'): void {
    const version = this.hashes().find((h) => h.hash === hash) || null;
    if (!version) return;

    side === 'left' ? this.before.set(version) : this.after.set(version);
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

  getInitialSelection = (side: 'left' | 'right') =>
    computed(() => {
      const currentHash =
        side === 'left' ? this.before()?.hash : this.after()?.hash;
      const availableOptions = this.dropdownOptions(); // Ensure dependency is tracked

      // Ensure currentHash is valid, otherwise fallback to the first available option
      return availableOptions.some((opt) => opt.value === currentHash)
        ? (currentHash ?? '')
        : availableOptions.length > 0
          ? availableOptions[0].value
          : '';
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
