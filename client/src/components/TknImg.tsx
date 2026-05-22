import appLogoPlaceHolder from "@/assets/app-logo-placeholder.png";
import { SkeletonPlaceholder } from "@carbon/react";
import { useEffect, useState } from "react";

type TknImgProps = {
  size: number;
  loading?: boolean;
  src?: string | null;
  alt?: string | null;
};

export function TknImg({ size, alt, loading = false, src }: TknImgProps) {
  const finalSrc = src ?? appLogoPlaceHolder;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [finalSrc]);

  if (loading) {
    return <SkeletonPlaceholder style={{ width: size, height: size }} />;
  }

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
      }}
    >
      {!loaded && <SkeletonPlaceholder style={{ width: size, height: size }} />}

      <img
        width={size}
        height={size}
        src={error ? appLogoPlaceHolder : finalSrc}
        alt={alt || undefined}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        style={{
          objectFit: "cover",
          borderRadius: "50%",
          width: size,
          height: size,
          visibility: loaded ? "inherit" : "hidden",
        }}
      />
    </div>
  );
}
