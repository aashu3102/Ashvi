"use client";

import { Code2, BookOpen, PenTool, BarChart3, GraduationCap, Compass, ArrowRight } from "lucide-react";

interface Props {
  onSelectCard?: (cardKey: string) => void;
}

export function CapabilityCardsGrid({ onSelectCard }: Props) {
  const cards = [
    {
      key: "build",
      title: "Build",
      desc: "Turn ideas into working software.",
      img: "/ashvi/build.jpg",
      icon: Code2,
    },
    {
      key: "research",
      title: "Research",
      desc: "Explore papers, sources and complex questions.",
      img: "/ashvi/research.jpg",
      icon: BookOpen,
    },
    {
      key: "create",
      title: "Create",
      desc: "Documents, presentations, images and more.",
      img: "/ashvi/create.jpg",
      icon: PenTool,
    },
    {
      key: "analyze",
      title: "Analyze",
      desc: "Understand data, files and problems.",
      img: "/ashvi/analyze.jpg",
      icon: BarChart3,
    },
    {
      key: "learn",
      title: "Learn",
      desc: "Study, practice and prepare.",
      img: "/ashvi/learn.jpg",
      icon: GraduationCap,
    },
    {
      key: "explore",
      title: "Explore",
      desc: "Ask anything. Discover something new.",
      img: "/ashvi/explore.jpg",
      icon: Compass,
    },
  ];

  return (
    <section className="ashvi-capability-cards-grid" aria-label="Capabilities grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className="ashvi-cap-card"
            onClick={() => onSelectCard && onSelectCard(card.key)}
            role="button"
            tabIndex={0}
          >
            <div className="ashvi-cap-card-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.img} alt={card.title} />
              <div className="ashvi-cap-card-thumb-badge" aria-hidden="true">
                <Icon size={13} />
              </div>
            </div>

            <div className="ashvi-cap-card-body">
              <div className="ashvi-cap-card-head">
                <h3 className="ashvi-cap-card-title">{card.title}</h3>
                <span className="ashvi-cap-card-arrow" aria-hidden="true">
                  <ArrowRight size={11} />
                </span>
              </div>
              <p className="ashvi-cap-card-desc">{card.desc}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
