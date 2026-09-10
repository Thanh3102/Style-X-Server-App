import { DateFilterOptionValue } from 'src/utils/types';
import { ReportPeriodService } from './report-period.service';

describe('ReportPeriodService', () => {
  it('creates one daily bucket for each day in the selected range', () => {
    const service = new ReportPeriodService();

    const periods = service.createPeriods(
      {
        startDate: new Date(2026, 1, 5),
        endDate: new Date(2026, 1, 6),
      },
      undefined
    );

    expect(periods).toHaveLength(2);
    expect(periods[0]).toEqual({
      date: new Date(2026, 1, 5),
      startDate: new Date(2026, 1, 5, 0, 0, 0, 0),
      endDate: new Date(2026, 1, 5, 23, 59, 59, 999),
      monthly: false,
    });
    expect(service.labelFor(periods[0])).toBe('5/2');
    expect(service.timeFor(periods[0])).toBe('5/2/2026');
  });

  it('creates monthly buckets for annual reports', () => {
    const service = new ReportPeriodService();

    const periods = service.createPeriods(
      {
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 11, 31, 23, 59, 59),
      },
      DateFilterOptionValue.THIS_YEAR
    );

    expect(periods).toHaveLength(12);
    expect(periods[0].monthly).toBe(true);
    expect(periods[0].startDate).toEqual(new Date(2026, 0, 1));
    expect(periods[0].endDate).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
    expect(service.labelFor(periods[0])).toBe('Tháng 1');
    expect(service.timeFor(periods[0])).toBe('T1/2026');
    expect(periods[11].startDate).toEqual(new Date(2026, 11, 1));
  });
});
