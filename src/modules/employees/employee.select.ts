import { Prisma } from '@prisma/client';

export const employeeBasicInfoSelect = {
  id: true,
  code: true,
  username: true,
  name: true,
  email: true,
  gender: true,
  dateOfBirth: true,
  createdAt: true,
  lastLoginAt: true,
  phoneNumber: true,
  isEmployed: true,
  roleId: true,
} satisfies Prisma.EmployeeSelect;

export const employeeWithPasswordSelect = {
  password: true,
  ...employeeBasicInfoSelect,
} satisfies Prisma.EmployeeSelect;

export const employeeWithVoidSelect = {
  password: true,
  void: true,
  ...employeeBasicInfoSelect,
} satisfies Prisma.EmployeeSelect;

export type EmployeeBasicInfo = Prisma.EmployeeGetPayload<{
  select: typeof employeeBasicInfoSelect;
}>;

export type EmployeeWithPassword = Prisma.EmployeeGetPayload<{
  select: typeof employeeWithPasswordSelect;
}>;

export type EmployeeWithVoid = Prisma.EmployeeGetPayload<{
  select: typeof employeeWithVoidSelect;
}>;
