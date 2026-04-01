import appLogoPlaceHolder from "@/assets/app-logo-placeholder.png";
import { SkeletonPlaceholder } from "@carbon/react";

type TknImgProps = {
  size: number;
  loading?: boolean;
  src?: string | null;
  alt?: string | null;
};

export function TknImg({ size, alt, loading = false, src }: TknImgProps) {
  return loading ? (
    <SkeletonPlaceholder style={{ width: size, height: size }} />
  ) : (
    <img
      width={size}
      height={size}
      src={src ?? appLogoPlaceHolder}
      alt={alt || undefined}
      style={{ objectFit: "cover", borderRadius: "50%" }}
    />
  );
}
