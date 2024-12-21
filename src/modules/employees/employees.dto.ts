export class CreateRoleDto {
  name: string;
  permissionIds: number[];
}

export class UpdateRoleDto {
  id: number;
  name: string;
  permissionIds: number[];
}

export class CreateEmployeeDto {
  name: string;
  roleId: number;
  email: string;
  phoneNumber: string;
  gender: number;
  dateOfBirth: string;
}

export class UpdateEmployeeDto {
  id: number;
  name: string;
  roleId: number;
  email: string;
  phoneNumber: string;
  gender: number;
  dateOfBirth: string;
  isEmployed: boolean;
  password: string;
};
