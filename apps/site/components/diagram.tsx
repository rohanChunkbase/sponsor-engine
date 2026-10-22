import Image from "next/image";

export function Diagram({
  src,
  alt,
  width,
  height,
  caption,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  priority?: boolean;
}) {
  const frame = (
    <div className="product-frame">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1120px) 1120px, 100vw"
        className="block h-auto w-full"
      />
    </div>
  );

  if (!caption) return frame;

  return (
    <figure className="figure">
      {frame}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
