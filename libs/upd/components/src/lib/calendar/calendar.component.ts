import {
  Component,
  ViewChild,
  Output,
  EventEmitter,
  Input,
  SimpleChanges,
  OnChanges,
  ViewEncapsulation,
  signal,
  WritableSignal,
  effect,
} from '@angular/core';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { DatePicker } from 'primeng/datepicker';
import { dateRangeConfigs } from '@dua-upd/utils-common';

dayjs.extend(utc);
dayjs.extend(timezone);

export type DateRangePreset = {
  label: string;
  value: {
    start: Date;
    end: Date;
  } | null;
};

@Component({
    selector: 'upd-calendar',
    templateUrl: './calendar.component.html',
    styleUrls: ['./calendar.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class CalendarComponent implements OnChanges {
  @ViewChild('myCalendar') datePicker!: DatePicker;

  @Input() granularity = 'day';
  @Input() showPreset = false;
  @Input() showAction = false;
  @Input() required = false;
  @Input() dateFormat = 'M dd yy';
  @Input() invalid = false;
  @Input() set initialDates(dates: Date[] | undefined) {
    if (dates?.length) {
      this.calendarDates = dates;
      this.dates.set([...dates]);
    }
  }

  @Output() dateChange = new EventEmitter<Date[] | Date>();

  calendarDates?: Date[];

  dates: WritableSignal<Date[]> = signal([]);

  minDate = dayjs().subtract(3, 'year').subtract(1, 'month').startOf('month').toDate();
  minSelectableDate = this.minDate;
  maxSelectableDate = dayjs().startOf('day').subtract(1, 'day').toDate();

  startOfWeek = dayjs().startOf('week').toDate();

  disabledDays: number[] = [1, 2, 3, 4, 5, 6];
  disabledDates: Date[] = [this.startOfWeek];

  presetOptions: DateRangePreset[] = [
    {
      label: 'None',
      value: null,
    },
    ...dateRangeConfigs.map((config) => {
      const dateRange = config.getDateRange();
      return {
        label: config.label,
        value: {
          // the presets are in UTC, so we need to convert them back to the local timezone
          start: dayjs(dateRange.start).tz(dayjs.tz.guess(), true).toDate(),
          end: dayjs(dateRange.end).tz(dayjs.tz.guess(), true).toDate(),
        },
      };
    }),
  ];

  constructor() {
    effect(
      () => {
        const dates = this.dates();

        if (dates.length === 0 || dates.length === 2) {
          this.dateChange.emit(dates);
        }
      }
    );
  }

  resetSelection(): void {
    this.dates.set([]);
    this.minSelectableDate = this.minDate;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['granularity']) return;

    if (this.granularity === 'month') {
      this.maxSelectableDate = dayjs()
        .subtract(1, 'month')
        .endOf('month')
        .toDate();
      return;
    }

    if (this.granularity === 'week') {
      this.minSelectableDate = this.minDate;
      this.disabledDays = [1, 2, 3, 4, 5, 6];
      this.maxSelectableDate = dayjs()
        .subtract(1, 'week')
        .endOf('week')
        .toDate();

      return;
    }

    this.maxSelectableDate = dayjs().subtract(1, 'day').toDate();
  }

  closeCalendar() {
    this.datePicker.overlayVisible = false;
  }

  resetCalendar() {
    this.datePicker.clear();
    this.minSelectableDate = this.minDate;
    this.dates.set([]);
  }

  handleSelect(granularity: string, date: Date) {
    let dates = this.dates();
    const currentDate = dayjs(date).toDate();
    if (dates.length === 2 || !dates.length) {
      dates = [currentDate];
    } else {
      dates.push(currentDate);
    }

    this.dates.set([...dates]);
    const [startDate, endDate] = dates;

    if (!startDate) {
      this.resetSelection();
      return;
    }

    if (endDate && dayjs(endDate).isBefore(dayjs(startDate))) {
      this.resetSelection();
      this.dates.set([currentDate]);
      return;
    }

    if (granularity === 'week') {
      if (!startDate || startDate.getDay() === 6) {
        this.resetSelection();
        return;
      } else if (!endDate) {
        this.minSelectableDate = startDate;
        this.disabledDays = [0, 1, 2, 3, 4, 5];
        return;
      }
      this.minSelectableDate = this.minDate;
      this.disabledDays = [1, 2, 3, 4, 5, 6];
    } else if (granularity === 'month' && dates.length === 2) {
      const endOfMonth = dayjs(date).endOf('month').toDate();

      this.dates.update((dates) => [dates[0], endOfMonth]);

      this.calendarDates = [dates[0], endOfMonth];
    }
  }

  onPresetSelect(preset: DateRangePreset['value']) {
    if (!preset) {
      return;
    }

    const { start, end } = preset;

    const startDate = dayjs(start).toDate();
    const endDate = dayjs(end).toDate();

    // make sure timezone offset is correct
    this.dates.set([startDate, endDate]);
    this.calendarDates = [startDate, endDate];
  }

  isInRangeDate(date: { month: number; day: number; year: number }) {
    const [startDate, endDate] = this.datePicker.value
      ? this.datePicker.value.map((d: Date) => dayjs(d))
      : [null, null];
    const currentDate = dayjs(new Date(date.year, date.month, date.day));
    return (
      startDate &&
      endDate &&
      currentDate.isAfter(startDate) &&
      currentDate.isBefore(endDate)
    );
  }

  isStartDate(date: { month: number; day: number; year: number }) {
    const startDate = this.datePicker.value
      ? dayjs(this.datePicker.value[0])
      : null;
    return startDate
      ? date.day === startDate.date() &&
          date.month === startDate.month() &&
          date.year === startDate.year()
      : false;
  }

  isEndDate(date: { month: number; day: number; year: number }) {
    const endDate = this.datePicker.value
      ? dayjs(this.datePicker.value[1])
      : null;
    return endDate
      ? date.day === endDate.date() &&
          date.month === endDate.month() &&
          date.year === endDate.year()
      : false;
  }
}
