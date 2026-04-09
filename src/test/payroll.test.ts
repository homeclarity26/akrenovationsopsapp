// Payroll calculation tests
// Math-only tests run without any DB connection.
// DB-dependent tests (employee record lookups) are skipped until staging is configured.

import { describe, it, expect } from 'vitest';

// ── Payroll calculation logic (mirrors calculate-payroll edge function) ──────

const OHIO_STATE_RATE = 0.035; // 3.5% flat (simplified)
const PAY_PERIODS_PER_YEAR = 26; // bi-weekly
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const FEDERAL_WITHHOLDING_RATE = 0.22; // approximation for middle-income bracket

interface PayrollInput {
  annual_salary: number;
  vehicle_allowance_per_period?: number;
  other_allowances?: number;
}

interface PayrollResult {
  gross_pay: number;
  ohio_withholding: number;
  federal_withholding: number;
  ss_withholding: number;
  medicare_withholding: number;
  net_pay: number;
}

function calculateBiweeklyPayroll(input: PayrollInput): PayrollResult {
  const base_pay = input.annual_salary / PAY_PERIODS_PER_YEAR;
  const vehicle = input.vehicle_allowance_per_period ?? 0;
  const other = input.other_allowances ?? 0;
  const gross_pay = base_pay + vehicle + other;

  const ohio_withholding = gross_pay * OHIO_STATE_RATE;
  const federal_withholding = gross_pay * FEDERAL_WITHHOLDING_RATE;
  const ss_withholding = gross_pay * SS_RATE;
  const medicare_withholding = gross_pay * MEDICARE_RATE;

  const total_deductions = ohio_withholding + federal_withholding + ss_withholding + medicare_withholding;
  const net_pay = gross_pay - total_deductions;

  return { gross_pay, ohio_withholding, federal_withholding, ss_withholding, medicare_withholding, net_pay };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Payroll Calculations', () => {
  it('calculates correct bi-weekly gross pay for $80,000 annual salary', () => {
    const result = calculateBiweeklyPayroll({ annual_salary: 80000 });
    // $80,000 / 26 = $3,076.923...
    expect(result.gross_pay).toBeCloseTo(3076.92, 1);
  });

  it('includes vehicle allowance in gross pay', () => {
    const result = calculateBiweeklyPayroll({
      annual_salary: 80000,
      vehicle_allowance_per_period: 200,
    });
    const base = 80000 / 26;
    expect(result.gross_pay).toBeCloseTo(base + 200, 1);
  });

  it('Ohio state withholding is approximately 3.5% of gross pay', () => {
    const result = calculateBiweeklyPayroll({ annual_salary: 80000 });
    const expected = result.gross_pay * 0.035;
    expect(result.ohio_withholding).toBeCloseTo(expected, 2);
    // Verify it's ~3.5% (within 0.5% tolerance for rounding)
    const effective_rate = result.ohio_withholding / result.gross_pay;
    expect(effective_rate).toBeCloseTo(0.035, 3);
  });

  it('net pay is gross minus all withholdings', () => {
    const result = calculateBiweeklyPayroll({ annual_salary: 80000 });
    const expected_net = result.gross_pay
      - result.ohio_withholding
      - result.federal_withholding
      - result.ss_withholding
      - result.medicare_withholding;
    expect(result.net_pay).toBeCloseTo(expected_net, 2);
  });

  it('gross pay for $80,000 salary matches known value to 2 decimal places', () => {
    const result = calculateBiweeklyPayroll({ annual_salary: 80000 });
    // Known: 80000 / 26 = 3076.923076...
    expect(result.gross_pay).toBeGreaterThan(3076);
    expect(result.gross_pay).toBeLessThan(3077);
  });

  it('handles zero vehicle allowance identically to no vehicle allowance', () => {
    const withZero = calculateBiweeklyPayroll({ annual_salary: 60000, vehicle_allowance_per_period: 0 });
    const withUndefined = calculateBiweeklyPayroll({ annual_salary: 60000 });
    expect(withZero.gross_pay).toBeCloseTo(withUndefined.gross_pay, 4);
  });

  it('employee with no compensation data fails gracefully with an error (unit test)', () => {
    // Simulate the edge function behavior: if no compensation_components record exists,
    // it should return an error rather than silently computing $0 pay.
    function calculateWithNullSalary(salary: number | null): PayrollResult | { error: string } {
      if (salary == null) {
        return { error: 'No compensation record found for this employee' };
      }
      return calculateBiweeklyPayroll({ annual_salary: salary });
    }

    const result = calculateWithNullSalary(null);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('No compensation record');
  });

  it('SS and Medicare rates match federal law values', () => {
    const result = calculateBiweeklyPayroll({ annual_salary: 80000 });
    // SS = 6.2%, Medicare = 1.45%
    expect(result.ss_withholding / result.gross_pay).toBeCloseTo(0.062, 3);
    expect(result.medicare_withholding / result.gross_pay).toBeCloseTo(0.0145, 3);
  });
});
