import { Component, inject, Input } from '@angular/core';
import { formatDate, formatPercent, formatNumber } from '@angular/common';
import { NgbPopoverConfig } from '@ng-bootstrap/ng-bootstrap';
import dayjs from 'dayjs';
import type { RowInput } from 'jspdf-autotable';
import * as FileSaver from 'file-saver';
import type { ColumnConfig } from '@dua-upd/types-common';
import { DropdownOption } from '../dropdown/dropdown.component';
import { I18nFacade } from '@dua-upd/upd/state';
import { PageStatus, ProjectStatus } from '@dua-upd/types-common';

@Component({
    selector: 'upd-data-table-exports',
    template: `
    <upd-dropdown
      [options]="exportOptions"
      [id]="'exports-' + id"
      icon="file_download"
      (selectOption)="this.exportFile($event.value)"
      [placeholder]="placeholder"
      [actionOnly]="true"
    >
    </upd-dropdown>
  `,
    styles: [],
    providers: [NgbPopoverConfig],
    standalone: false
})
export class DataTableExportsComponent<T> {
  private i18n = inject(I18nFacade);
  private config: NgbPopoverConfig;

  utf8Encoder = new TextEncoder();

  placeholder: DropdownOption<'placeholder'> = {
    label: 'Export',
    value: 'placeholder',
  };

  exportOptions: DropdownOption<'csv' | 'pdf' | 'xlsx' | null>[] = [
    { label: 'CSV', icon: 'file', value: 'csv' },
    { label: 'PDF', icon: 'file-pdf', value: 'pdf' },
    { label: 'XLSX', icon: 'file-excel', value: 'xlsx' },
  ];

  @Input() id!: string;
  @Input() data: T[] = [];
  @Input() cols: ColumnConfig<T>[] = [];

  constructor() {
    const config = inject(NgbPopoverConfig);

    config.placement = 'right';
    config.triggers = 'hover focus';

    this.config = config;
  }

  async getFormattedExportData(replaceKeysWithHeaders = false) {
    const currentLang = this.i18n.service.currentLang;
    const cops = this.i18n.service.translate('COPS', currentLang);
    const wos_cops = this.i18n.service.translate('WOS_COPS', currentLang);

    const projectStatusKeys: ProjectStatus[] = [
      'Unknown',
      'Complete',
      'Delayed',
      'Paused',
      'Exploratory',
      'Monitoring',
      'In Progress',
      'Needs review',
      'Planning',
    ];

    const pageStatusKeys: PageStatus[] = ['Live', '404', 'Redirected'];

    const projectStatuses = (await this.i18n.service.get(
      projectStatusKeys,
    )) as Record<string, string>;

    const pageStatuses = (await this.i18n.service.get(
      pageStatusKeys,
    )) as Record<string, string>;

    return this.data.map((row) =>
      this.cols.reduce(
        (formattedRow, col) => {
          const colKey = replaceKeysWithHeaders ? col.header : col.field;
          const cellValue = row[col.field as keyof T];

          if (!cellValue) {
            formattedRow[colKey] = '';
          } else if (Array.isArray(cellValue)) {
            formattedRow[colKey] = cellValue.join(', ');
          } else if (col.secondaryField) {
            formattedRow[colKey] = `${formatPercent(
              (<unknown>cellValue) as number,
              currentLang,
              col.pipeParam,
            )} (${formatNumber(
              (<unknown>row[col.secondaryField.field as keyof T]) as number,
              currentLang,
              col.secondaryField.pipeParam,
            )})` as string;
          } else if (col.pipe === 'percent') {
            formattedRow[colKey] = formatPercent(
              (<unknown>cellValue) as number,
              currentLang,
            );
          } else if (col.pipe === 'number') {
            formattedRow[colKey] = formatNumber(
              (<unknown>cellValue) as number,
              currentLang,
            );
          } else if (col.pipe === 'date') {
            formattedRow[colKey] = formatDate(
              (<unknown>cellValue) as Date,
              col.pipeParam ?? 'yyyy-MM-dd',
              currentLang,
              'UTC',
            );
          } else if (col.typeParam === 'cops') {
            formattedRow[colKey] = cellValue ? cops : '';
          } else if (col.typeParam === 'wos_cops') {
            formattedRow[colKey] = cellValue ? wos_cops : ''; 
          } else if (col.filterConfig?.type === 'pageStatus') {
            formattedRow[colKey] = pageStatuses[(<unknown>cellValue) as string];
          } else if (col.type === 'label') {
            formattedRow[colKey] =
              projectStatuses[(<unknown>cellValue) as string];
          } else {
            formattedRow[colKey] = (<unknown>cellValue) as string;
          }

          return formattedRow;
        },
        {} as Record<string, string>,
      ),
    );
  }

  async exportCsv() {
    if (this.data.length) {
      const data = await this.getFormattedExportData(true);

      const headerRow = Object.keys(data[0]).map(
        (header: string) => `"${this.i18n.service.instant(header)}"`,
      );
      const dataRows = data.map((row) =>
        Object.values(row).map((cellData) => `"${cellData}"`),
      );

      const csvData = [headerRow, ...dataRows];

      const csvOutput = csvData.map((csvRow) => csvRow.join(',')).join('\n');

      // UTF-8 Byte-order mark (so that Excel knows to use UTF-8)
      // https://en.wikipedia.org/wiki/Byte_order_mark#Byte_order_marks_by_encoding
      const BOM = Uint8Array.from([0xef, 0xbb, 0xbf]);

      const encodedCsv = this.utf8Encoder.encode(csvOutput);

      const blob = new Blob([BOM, encodedCsv], {
        type: 'text/csv;charset=utf-8;',
        endings: 'native',
      });

      const date = dayjs().format('YYYY-MM-DD');

      FileSaver.saveAs(blob, `upd-data-table_export_${date}.csv`, {
        autoBom: false,
      });
    }
  }

  async exportPdf() {
    const { jsPDF } = await import('jspdf');
    const { autoTable } = await import('jspdf-autotable');

    try {
      const columnsExport = this.cols.map((obj) => ({
        dataKey: obj.field,
        title: this.i18n.service.instant(obj.header),
      }));

      const minCellWidth =
        columnsExport.length === 1 ? 100 : 100 / (columnsExport.length - 1);

      const doc = new jsPDF('p', 'mm', 'a4');

      autoTable(doc, {
        styles: { halign: 'left' },
        body: (await this.getFormattedExportData()) as RowInput[],
        bodyStyles: { overflow: 'linebreak', minCellWidth: minCellWidth },
        columns: columnsExport,
        head: [columnsExport.map((col) => col.title)],
      });

      const date = dayjs().format('YYYY-MM-DD');

      doc.save(`upd-table-data_export_${date}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF file:', err);
    }
  }

  async exportExcel() {
    const { utils, write } = await import('xlsx');

    try {
      if (this.data && this.data.length > 0) {
        // Create a new object using only data used in the table and
        // replacing the keys with the appropriate headers

        const exportData = await this.getFormattedExportData(true);
        const headers = Object.keys(exportData[0]).map((header: string) =>
          this.i18n.service.instant(header),
        );

        const worksheet = utils.json_to_sheet(exportData);

        utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });

        const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
        const excelBuffer: ArrayBuffer = write(workbook, {
          bookType: 'xlsx',
          type: 'array',
        });

        this.saveAsExcelFile(excelBuffer, 'upd-data-table');
      }
    } catch (err) {
      console.error('Error exporting Excel file:', err);
    }
  }

  saveAsExcelFile(buffer: ArrayBuffer, fileName: string) {
    const date = dayjs().format('YYYY-MM-DD');

    const data = new Blob([buffer], {
      type: 'application/octet-stream',
      endings: 'native',
    });

    FileSaver.saveAs(data, `${fileName}_export_${date}.xlsx`);
  }

  async exportFile(fileType: 'csv' | 'pdf' | 'xlsx' | null) {
    if (!fileType) return;

    switch (fileType) {
      case 'csv':
        await this.exportCsv();
        break;
      case 'pdf':
        await this.exportPdf();
        break;
      case 'xlsx':
        await this.exportExcel();
    }
  }
}
