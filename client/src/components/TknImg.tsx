import appLogoPlaceHolder from "@/assets/app-logo-placeholder.png";
import { SkeletonPlaceholder } from "@carbon/react";
import { useState } from "react";

type TknImgProps = {
  size: number;
  loading?: boolean;
  src?: string | null;
  alt?: string | null;
};

export function TknImg({ size, alt, loading = false, src }: TknImgProps) {
  const [error, setError] = useState(false);

  if (loading) {
    return <SkeletonPlaceholder style={{ width: size, height: size }} />;
  }

  return (
    <img
      width={size}
      height={size}
      src={error ? appLogoPlaceHolder : (src ?? appLogoPlaceHolder)}
      alt={alt || undefined}
      onError={() => setError(true)}
      style={{ objectFit: "cover", borderRadius: "50%" }}
    />
  );
}
