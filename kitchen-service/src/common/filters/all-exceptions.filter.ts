import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      this.handleHttp(exception, host);
      return;
    }
    this.handleRpc(exception, host);
  }

  private handleHttp(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const responseBody: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (typeof exceptionResponse === 'string') {
      responseBody.message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      Object.assign(responseBody, exceptionResponse);
    } else {
      responseBody.message = 'Internal server error';
    }

    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json(responseBody);
  }

  private handleRpc(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToRpc();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const pattern: string = ctx.getContext().getPattern?.() ?? 'unknown';

    let errorResponse: { status: string; error: string; message: string };

    if (exception instanceof RpcException) {
      const rawError = exception.getError();
      let errorMsg = 'Unknown RPC error';
      let errorName = 'RpcException';

      if (typeof rawError === 'string') {
        errorMsg = rawError;
      } else if (
        typeof rawError === 'object' &&
        rawError !== null &&
        'message' in rawError
      ) {
        const obj = rawError as Record<string, unknown>;
        errorMsg =
          typeof obj.message === 'string'
            ? obj.message
            : JSON.stringify(obj.message);
        if ('error' in obj) {
          errorName =
            typeof obj.error === 'string'
              ? obj.error
              : JSON.stringify(obj.error);
        }
      }

      errorResponse = { status: 'error', error: errorName, message: errorMsg };
    } else if (exception instanceof Error) {
      errorResponse = {
        status: 'error',
        error: exception.name,
        message: exception.message,
      };
    } else {
      errorResponse = {
        status: 'error',
        error: 'UnknownError',
        message: 'An unknown error occurred',
      };
    }

    this.logger.error(
      `RPC error on pattern "${pattern}": ${errorResponse.message}`,
      exception instanceof Error ? exception.stack : '',
    );

    throw exception instanceof RpcException
      ? exception
      : new RpcException(errorResponse);
  }
}
