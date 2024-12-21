export type FindQuery = {
  q: string;
  page: string;
  limit: string;
};

export type CreateRoleDto = {
  name: string;
  permissionIds: number[];
};

export type UpdateRoleDto = {
  id: number;
  name: string;
  permissionIds: number[];
};

export type CreateEmployeeDto = {
  name: string;
  roleId: number;
  email: string;
  phoneNumber: string;
  gender: number;
  dateOfBirth: string;
};

export type UpdateEmployeeDto = {
  id: number;
  name: string;
  roleId?: number;
  email: string;
  phoneNumber: string;
  gender: number;
  dateOfBirth: string;
  isEmployed?: boolean;
};
