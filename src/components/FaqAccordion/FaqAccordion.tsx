'use client';

import { useState } from 'react';
import cn from 'classnames';
import s from './FaqAccordion.module.css';

// Replaces the main.js handler:
//   $('.faq-item .question').click(function() {
//     $(this).parent().toggleClass('active');
//     $(this).parent().siblings().removeClass('active');
//   });
export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={s.faqList}>
      {items.map((item, i) => (
        <div className={cn(s.faqItem, { [s.active]: openIndex === i })} key={i}>
          <div className={s.question} onClick={() => setOpenIndex(openIndex === i ? null : i)}>
            {item.question}
          </div>
          <div className={s.answer}>{item.answer}</div>
        </div>
      ))}
    </div>
  );
}
