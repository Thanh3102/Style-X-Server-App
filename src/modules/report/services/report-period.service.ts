import { Injectable } from '@nestjs/common';
import { DateFilterOptionValue } from 'src/utils/types/query.types';
import { ReportDateRange } from './report-date-range.service';

export type ReportPeriod = {
  date: Date;
  startDate: Date;
  endDate: Date;
  monthly: boolean;
};

@Injectable()
export class ReportPeriodService {
  createPeriods(range: ReportDateRange, reportDate?: string): ReportPeriod[] {
    if (!range.startDate || !range.endDate) {
      return [];
    }

    const monthly =
      reportDate === DateFilterOptionValue.THIS_YEAR ||
      reportDate === DateFilterOptionValue.LAST_YEAR;
    const periods: ReportPeriod[] = [];
    const currentDate = new Date(range.startDate);

    while (currentDate <= range.endDate) {
      const date = new Date(currentDate);

      if (monthly) {
        const startDate = new Date(currentDate);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(currentDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);

        periods.push({ date, startDate, endDate, monthly });
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        const startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);

        periods.push({ date, startDate, endDate, monthly });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return periods;
  }

  labelFor(period: ReportPeriod): string {
    const [day, month] = this.dateParts(period.date);
    return period.monthly ? `Tháng ${month}` : `${day}/${month}`;
  }

  timeFor(period: ReportPeriod): string {
    const [day, month, year] = this.dateParts(period.date);
    return period.monthly ? `T${month}/20${year}` : `${day}/${month}/20${year}`;
  }

  private dateParts(date: Date): string[] {
    return Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
    })
      .format(date)
      .split('/');
  }
}
