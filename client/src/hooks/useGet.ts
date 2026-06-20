// I stopped trying to understand this a while ago
import type {
    ClientRequest,
    ClientRequestOptions,
    ClientResponse,
} from "hono/client";
import useSWR from "swr";

type GetInput<T> =
  T extends ClientRequest<any, any, infer S>
    ? S["$get"] extends { input: infer R }
      ? R
      : {}
    : {};

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

type UseGetConfig<Success, Transformed> = {
  options?: ClientRequestOptions;
  select?: (data: Success) => Transformed;
  enabled?: boolean;
};

export function useGet<
  T extends {
    $get: (...params: any[]) => Promise<ClientResponse<any, any, any>>;
    $url: (...params: any[]) => any;
  },
  SuccessStatus extends number,
  Response = Awaited<ReturnType<T["$get"]>>,
  SuccessResponseType = SuccessResponse<Response, SuccessStatus>,
  Success = SuccessJson<SuccessResponseType>,
  Transformed = Success,
  Error = ErrorResponse<Response, SuccessStatus>,
>(
  request: T,
  successStatus: SuccessStatus,
  ...params: HasRequiredKeys<GetInput<T>> extends true
    ? [args: GetInput<T>, config?: UseGetConfig<Success, Transformed>]
    : [args?: GetInput<T>, config?: UseGetConfig<Success, Transformed>]
) : UseGetResp<NoInfer<Transformed>, Error>{
  const [args, config] = params;
  const { options, select, enabled = true } = config ?? {};

  return useSWR<Transformed, Error>(
    enabled ? request.$url(args).href : null,
    async () => {
      const res = await (request.$get as any)(args, options);
      if (res.status != successStatus) {
        throw res;
      }

      const json = await res.json();

      return select ? select(json as Success) : (json as Transformed);
    },
    {
      revalidateOnFocus: false,
      // keepPreviousData: true,
      revalidateOnReconnect: false,
      // revalidateIfStale: false,
    },
  );
}

export type UseGetResp<Data, Error = any> = {
  isLoading: boolean;
  isValidating: boolean;
  data: Data | undefined;
  error: Error | undefined;
};
