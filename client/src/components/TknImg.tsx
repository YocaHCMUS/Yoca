import appLogoPlaceHolder from "@/assets/app-logo-placeholder.png";
import { SkeletonPlaceholder } from "@carbon/react";

type TknImgProps = {
  size: number;
  loading?: boolean;
  src: string | null | undefined;
};

export function TknImg({ size, loading = false, src }: TknImgProps) {
  return loading ? (
    <SkeletonPlaceholder style={{ width: size, height: size }} />
  ) : (
    <img
      width={48}
      src={src ?? appLogoPlaceHolder}
      style={{ borderRadius: "50%" }}
    />
  );
}
