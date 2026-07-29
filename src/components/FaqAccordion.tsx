"use client";

import { useState } from "react";

// Replaces the main.js handler:
//   $('.faq-item .question').click(function() {
//     $(this).parent().toggleClass('active');
//     $(this).parent().siblings().removeClass('active');
//   });
// Same markup/classes (.faq-list, .faq-item, .question, .answer) so
// css/style.css applies unchanged.
export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <div className={`faq-item${openIndex === i ? " active" : ""}`} key={i}>
          <div className="question" onClick={() => setOpenIndex(openIndex === i ? null : i)}>
            {item.question}
          </div>
          <div className="answer">{item.answer}</div>
        </div>
      ))}
    </div>
  );
}
