import appLogoPlaceHolder from "@/assets/app-logo-placeholder.png";
import { useEffect, useState } from "react";

type TknImgProps = {
  size: number;
  loading?: boolean;
  src?: string | null;
  alt?: string | null;
};

const placeholderStyle = (size: number) => ({
  width: size,
  height: size,
  borderRadius: "50%",
  background: "linear-gradient(110deg, rgba(148, 163, 184, .14) 18%, rgba(148, 163, 184, .28) 34%, rgba(148, 163, 184, .14) 52%)",
  backgroundSize: "220% 100%",
  animation: "yoca-token-image-shimmer 1.25s linear infinite",
});

export function TknImg({ size, alt, loading = false, src }: TknImgProps) {
  const finalSrc = src ?? appLogoPlaceHolder;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [finalSrc]);

  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      {(loading || !loaded) && <span aria-hidden="true" style={{ position: "absolute", inset: 0, ...placeholderStyle(size) }} />}
      {!loading && (
        <img
          width={size}
          height={size}
          src={error ? appLogoPlaceHolder : finalSrc}
          alt={alt || undefined}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
          style={{ objectFit: "cover", borderRadius: "50%", width: size, height: size, opacity: loaded ? 1 : 0, transition: "opacity .16s ease" }}
        />
      )}
      <style>{`@keyframes yoca-token-image-shimmer { 0% { background-position: 180% 0; } 100% { background-position: -40% 0; } }`}</style>
    </div>
  );
}
