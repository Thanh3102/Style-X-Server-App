import { DateFilterOptionValue } from 'src/utils/types/query.types';
import { ReportDateRangeService } from './report-date-range.service';

describe('ReportDateRangeService', () => {
  it('overrides a preset range with explicit minimum and maximum dates', () => {
    const service = new ReportDateRangeService();

    expect(
      service.resolve({
        reportDate: DateFilterOptionValue.THIS_MONTH,
        reportDateMin: '05/02/2026',
        reportDateMax: '14/02/2026',
      })
    ).toEqual({
      startDate: new Date('2026-02-05'),
      endDate: new Date('2026-02-14'),
    });
  });

  it('can use today as the default for detail reports', () => {
    const service = new ReportDateRangeService();

    const result = service.resolve({}, { defaultToToday: true });

    expect(result.startDate.getHours()).toBe(0);
    expect(result.startDate.getMinutes()).toBe(0);
    expect(result.endDate.getHours()).toBe(23);
    expect(result.endDate.getMinutes()).toBe(59);
  });
});
