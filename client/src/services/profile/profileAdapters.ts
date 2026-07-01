import type { ProfilePageData } from "@/types/profile";

export interface RawProfileApiPayload extends ProfilePageData { }

export function adaptProfilePayload(payload: RawProfileApiPayload): ProfilePageData {
    return {
        ...payload,
        overview: {
            ...payload.overview,
            displayName: payload.overview.displayName.trim(),
        },
    };
}
