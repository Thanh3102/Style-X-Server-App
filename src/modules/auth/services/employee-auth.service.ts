import { Injectable, Logger } from '@nestjs/common';
import { EmployeesService } from '../../employees/employees.service';
import { TokenService } from './token.service';
import { EmployeeSignInDTO } from '../auth.dto';
import { EmployeeSignInResponseDTO, JWTPayload } from '../auth.types';


@Injectable()
export class EmployeeAuthService {
  constructor(
    private readonly employeeService: EmployeesService,
    private readonly tokenService: TokenService
  ) {}

  async signIn(dto: EmployeeSignInDTO): Promise<EmployeeSignInResponseDTO> {
    const employee = await this.employeeService.verifyUser(
      dto.username,
      dto.password
    );

    const payload: JWTPayload = {
      id: employee.id,
      username: employee.username,
      email: employee.email,
    };

    const { accessToken, refreshToken } = await this.tokenService.generateTokenPair(
      payload,
      dto.isRemember ?? false
    );

    return {
      user: {
        id: String(employee.id),
        username: employee.username,
        name: employee.name,
        email: employee.email,
      },
      accessToken,
      refreshToken,
      expiredIn: this.tokenService.getExpiredIn(),
    };
  }
}
