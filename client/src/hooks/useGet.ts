// I stopped trying to understand this a while ago
import type {
  ClientRequest,
  ClientRequestOptions,
  ClientResponse,
} from "hono/client";
import type { Endpoint, ResponseFormat } from "hono/types";
import useSWR from "swr";

type GetInput<T> =
  T extends ClientRequest<any, any, infer S>
  ? S["$get"] extends { input: infer R }
  ? R
  : {}
  : {};

type GetEndpoint<T> =
  T extends ClientRequest<any, any, infer S>
  ? S extends { $get: infer E }
  ? E
  : never
  : never;

type ClientResponseOfEndpoint<T extends Endpoint = Endpoint> = T extends {
  output: infer O;
  outputFormat: infer F;
  status: infer S;
}
  ? ClientResponse<
    O,
    S extends number ? S : never,
    F extends ResponseFormat ? F : never
  >
  : never;

type GetResponse<T> = ClientResponseOfEndpoint<GetEndpoint<T>>;

type HasRequiredKeys<T> = T extends object
  ? {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
  }[keyof T] extends never
  ? false
  : true
  : false;

type SuccessJson<R> = R extends { json: () => Promise<infer D> } ? D : never;

type ErrorResponse<R, S extends number> = R extends { status: infer U }
  ? U extends S
  ? never
  : R
  : never;

type SuccessResponse<R, S extends number> = R extends { status: S } ? R : never;

export function useGet<
  T extends { $get: any; $url: any },
  SuccessStatus extends number,
  Response = GetResponse<T>,
  SuccessResponseType = SuccessResponse<Response, SuccessStatus>,
  Success = SuccessJson<SuccessResponseType>,
  Transformed = Success,
>(
  request: T,
  successStatus: SuccessStatus,
  ...params: HasRequiredKeys<GetInput<T>> extends true
    ? [
      args: GetInput<T>,
      options?: ClientRequestOptions,
      select?: (data: Success) => Transformed,
    ]
    : [
      args?: GetInput<T>,
      options?: ClientRequestOptions,
      select?: (data: Success) => Transformed,
    ]
) {
  type Error = ErrorResponse<Response, SuccessStatus>;

  const [args, options, select] = params;

  return useSWR<Transformed, Error>(request.$url(args).pathname, async () => {
    const res = await (request.$get as any)(...params);
    if (res.status != successStatus) {
      throw res;
    }

    const json = await res.json();

    return select ? select(json as Success) : (json as Transformed);
  }, { keepPreviousData: true });
}
