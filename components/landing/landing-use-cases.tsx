import type { Dictionary } from "@/lib/i18n/dictionaries";

interface LandingUseCasesProps {
  dict: Dictionary["uses"];
}

export function LandingUseCases({ dict }: LandingUseCasesProps) {
  return (
    <section className="uses band" id="uses">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">
            <span className="dot">●</span> {dict.eyebrow}
          </span>
          <h2 className="display">{dict.title}</h2>
          <p>{dict.lead}</p>
        </div>
        <div className="use-grid">
          {dict.cards.map((card, i) => (
            <div className="use-card" key={i}>
              <span className="uc-tag">{card.tag}</span>
              <h3 className="display">{card.title}</h3>
              <p>{card.body}</p>
              <div className="uc-foot">
                {card.foot.map((stat, j) => (
                  <span key={j}>
                    <span className="v">{stat.value}</span> {stat.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
