import { Component, inject, Input } from '@angular/core';
import { formatDate, formatPercent, formatNumber } from '@angular/common';
import { NgbPopoverConfig } from '@ng-bootstrap/ng-bootstrap';
import dayjs from 'dayjs';
import type { RowInput } from 'jspdf-autotable';
import * as FileSaver from 'file-saver';
import type { ColumnConfig, ColumnConfigPipe } from '@dua-upd/types-common';
import { DropdownOption } from '../dropdown/dropdown.component';
import { I18nFacade } from '@dua-upd/upd/state';
import { SecondsToMinutesPipe } from '@dua-upd/upd/pipes';

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
export class DataTableExportsComponent<ColumnRow extends object, T extends object> {
  private i18n = inject(I18nFacade);
  private secondsToMinutes = inject(SecondsToMinutesPipe);

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
  @Input() cols: ColumnConfig<ColumnRow>[] = [];

  constructor() {
    const config = inject(NgbPopoverConfig);

    config.placement = 'right';
    config.triggers = 'hover focus';
  }

  async getFormattedExportData(replaceKeysWithHeaders = false) {
    const currentLang = this.i18n.service.currentLang;

    return this.data.map((row) =>
      this.cols.reduce(
        (formattedRow, col) => {
          const colKey = replaceKeysWithHeaders ? col.header : col.field;
          const cellValue = (row as Record<string, unknown>)[col.field];

          if (cellValue === null || cellValue === undefined) {
            formattedRow[colKey] = '';
          } else if (col.type === 'label') {
            const labelValues = Array.isArray(cellValue)
              ? cellValue
              : [cellValue];
            formattedRow[colKey] = labelValues
              .map((value) =>
                this.i18n.service.translate(String(value), currentLang),
              )
              .join(', ');
          } else if (col.type === 'change' && col.secondaryField) {
            const primaryValue = this.formatValue(
              cellValue,
              col.pipe,
              col.pipeParam,
              currentLang,
            );
            const secondaryValue = this.formatValue(
              (row as Record<string, unknown>)[col.secondaryField.field],
              col.secondaryField.pipe,
              col.secondaryField.pipeParam,
              currentLang,
            );

            formattedRow[colKey] = `${primaryValue} (${secondaryValue})`;
          } else if (Array.isArray(cellValue)) {
            formattedRow[colKey] = cellValue.join(', ');
          } else {
            formattedRow[colKey] = this.formatValue(
              cellValue,
              col.pipe,
              col.pipeParam,
              currentLang,
            );
          }

          return formattedRow;
        },
        {} as Record<string, string>,
      ),
    );
  }

  private formatValue(
    value: unknown,
    pipe: ColumnConfigPipe | undefined,
    pipeParam: string | undefined,
    currentLang: string,
  ) {
    if (value === null || value === undefined) return '';

    switch (pipe) {
      case 'percent':
        return formatPercent(value as number, currentLang, pipeParam);
      case 'number':
        return formatNumber(value as number, currentLang, pipeParam);
      case 'date':
        return formatDate(
          value as Date,
          pipeParam ?? 'yyyy-MM-dd',
          currentLang,
          'UTC',
        );
      case 'secondsToMinutes':
        return typeof value === 'number'
          ? String(this.secondsToMinutes.transform(value))
          : String(value);
      default:
        return String(value);
    }
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
