import { Component, Input, effect, inject, input } from '@angular/core';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';
import { ColumnConfig } from '@dua-upd/types-common';
import { I18nFacade } from '@dua-upd/upd/state';
import { FR_CA } from '@dua-upd/upd/i18n';

dayjs.extend(localeData);
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(utc);

interface Cell {
  date: string;
  sum: number;
  fillColour?: string;
  textColour?: string;
  borderColour?: string;
  isEmpty?: boolean;
}

interface ColorThreshold {
  fill: string;
  border: string;
}

@Component({
    selector: 'upd-heatmap',
    templateUrl: './heatmap.component.html',
    styleUrls: ['./heatmap.component.scss'],
    standalone: false
})
export class HeatmapComponent<T> {
  private i18n = inject(I18nFacade);
  currentLang = this.i18n.currentLang;
  title = input('');
  data = input<Cell[]>([]);
  calendarMonths: Cell[][][] = [];
  dateParams = this.currentLang() == FR_CA ? 'd MMM YYYY' : 'MMM dd, YYYY';
  minSum = Infinity;
  maxSum = -Infinity;
  activeColor = '';
  colorThresholds: { [key: string]: ColorThreshold } = {
    lowest: { fill: '#FFF9C4', border: '#E6E09B' },
    low: { fill: '#FFEB3B', border: '#E6CC00' },
    medium: { fill: '#FFB74D', border: '#E69A00' },
    high: { fill: '#FF8000', border: '#CC6600' },
    highest: { fill: '#D32F2F', border: '#B71C1C' },
  };
  weekDays = dayjs.weekdaysMin();
  @Input() table: T[] = [];
  @Input() tableCols: ColumnConfig[] = [];

  constructor() {
    effect(() => {
      dayjs.locale(this.currentLang());
      this.weekDays = this.data().length <= 7 ? dayjs.weekdays() : dayjs.weekdaysMin();
    });

    effect(() => {
      this.initCalendar();
    });
  }

  initCalendar() {
    if (!this.data().length) return;
    this.calendarMonths = [];
    this.calculateMinMaxSums();
    
    if (this.isSingleWeek(this.data())) {
      this.calendarMonths = [this.generateWeekCalendar(this.data())];
    } else {
      this.populateCalendarMonths();
    }
  }

  isSingleWeek(data: Cell[]): boolean {
    return data.length <= 7;
  }

  generateWeekCalendar(data: Cell[]): Cell[][] {
    const rows: Cell[][] = [];
    const week: Cell[] = [];

    for (const cell of data) {
      week.push(this.createCell(cell));
    }

    while (week.length < 7) {
      week.push(this.emptyCell());
    }

    rows.push(week);

    return rows;
  }

  populateCalendarMonths() {
    let currentMonth = dayjs.utc(this.data()[0].date).startOf('month');
    const endMonth = dayjs.utc(this.data()[this.data().length - 1].date).startOf('month');

    while (currentMonth.isSameOrBefore(endMonth, 'month')) {
      this.calendarMonths.push(this.generateMonthCalendar(currentMonth));
      currentMonth = currentMonth.add(1, 'month');
    }
  }

  generateMonthCalendar(startOfMonth: dayjs.Dayjs): Cell[][] {
    const daysInMonth = startOfMonth.daysInMonth();
    const rows: Cell[][] = [];
    let week: Cell[] = new Array(startOfMonth.day()).fill(null).map(() => this.emptyCell());

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = startOfMonth.add(day - 1, 'day');
      const cell = this.data().find(d => dayjs.utc(d.date).isSame(currentDay, 'day'));

      if (cell) {
        week.push(this.createCell(cell));
      } else {
        week.push(this.emptyCell());
      }

      if (currentDay.day() === 6) {
        rows.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(this.emptyCell());
      }
      rows.push(week);
    }

    return rows;
  }

  fillInitialWeekDays(startOfMonth: dayjs.Dayjs, week: Cell[]): void {
    for (let i = 0; i < startOfMonth.day(); i++) {
      week.push(this.emptyCell());
    }
  }

  fillWeekDaysUntilCurrent(cellDate: dayjs.Dayjs, week: Cell[]): void {
    while (cellDate.day() !== week.length) {
      week.push(this.emptyCell());
    }
  }

  createCell(cell: Cell): Cell {
    const colourThresholds = this.getColorThreshold(cell.sum);
    return {
      ...cell,
      textColour: this.getTextColor(cell.sum),
      fillColour: colourThresholds.fill,
      borderColour: colourThresholds.border,
      isEmpty: false,
    };
  }

  completeWeekRows(week: Cell[], rows: Cell[][]): void {
    while (week.length < 7) {
      week.push(this.emptyCell());
    }
    if (week.length) rows.push(week);
  }

  calculateMinMaxSums(): void {
    this.minSum = Infinity;
    this.maxSum = -Infinity;

    for (const cell of this.data()) {
      this.minSum = Math.min(this.minSum, cell.sum);
      this.maxSum = Math.max(this.maxSum, cell.sum);
    }
  }

  getColorThreshold(sum: number) {
    const normalizedValue = (sum - this.minSum) / (this.maxSum - this.minSum);
    if (normalizedValue >= 0.8) return this.colorThresholds['highest'];
    if (normalizedValue >= 0.6) return this.colorThresholds['high'];
    if (normalizedValue >= 0.4) return this.colorThresholds['medium'];
    if (normalizedValue >= 0.2) return this.colorThresholds['low'];
    return this.colorThresholds['lowest'];
  }

  getTextColor(sum: number): string {
    return (sum - this.minSum) / (this.maxSum - this.minSum) <= 0.6 ? '#111' : '#fff';
  }

  emptyCell(): Cell {
    return { date: '', sum: 0, fillColour: '', textColour: '', isEmpty: true };
  }

  filterThresholdKeys(): string[] {
    return Object.keys(this.colorThresholds);
  }

  getMonthStartDate(monthIndex: number): string {
    return dayjs.utc(this.data()[0].date)
      .add(monthIndex, 'month')
      .startOf('month')
      .format('YYYY-MM-DD');
  }
}
