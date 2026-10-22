"use client";

import { useEffect, useRef } from "react";

export type RecapSlide = {
  id: string;
  heading: string;
  caption: string;
  image: string;
  portrait: string;
  shareX: string;
  shareLinkedIn: string;
};

export function RecapCarousel({ cards }: { cards: RecapSlide[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frames = [...scroller.querySelectorAll<HTMLElement>("[data-stretch]")];

    const update = () => {
      if (media.matches) {
        for (const frame of frames) frame.style.transform = "";
        return;
      }
      const viewMid = scroller.clientWidth / 2;
      for (const frame of frames) {
        const rect = frame.getBoundingClientRect();
        const parent = scroller.getBoundingClientRect();
        const center = rect.left - parent.left + rect.width / 2;
        const distance = Math.min(1, Math.abs(center - viewMid) / viewMid);
        const stretch = distance * 0.16;
        frame.style.transform = `scaleX(${(1 + stretch).toFixed(3)}) scaleY(${(1 - stretch * 0.62).toFixed(3)})`;
      }
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    media.addEventListener("change", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      media.removeEventListener("change", update);
    };
  }, [cards]);

  return (
    <div className="recap-scroller" ref={scrollerRef}>
      {cards.map((card) => (
        <article className="recap-slide" key={card.id} id={card.id}>
          <div className="recap-stretch" data-stretch="">
            <img src={card.image} alt={card.caption} width={1200} height={630} />
          </div>
          <h2>{card.heading}</h2>
          <p>{card.caption}</p>
          <div className="recap-actions">
            <a className="btn-primary" href={card.image} download={`${card.id}.png`}>
              Download
            </a>
            <a className="btn-secondary" href={card.portrait} download={`${card.id}-portrait.png`}>
              Download portrait
            </a>
            <a className="btn-secondary" href={card.shareX} target="_blank" rel="noreferrer">
              Share on X
            </a>
            <a className="btn-secondary" href={card.shareLinkedIn} target="_blank" rel="noreferrer">
              Share on LinkedIn
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
