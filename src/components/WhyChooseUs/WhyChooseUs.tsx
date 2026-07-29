import cn from 'classnames';
import { Calculator } from '@/components/Calculator';
import s from './WhyChooseUs.module.css';

const WHY_US_ITEMS = [
  {
    icon: 'icon-whyus-1',
    title: 'Delivery Speed',
    desc: 'If you prioritize speed, you’ll definitely love our services – we are the fastest.',
  },
  {
    icon: 'icon-whyus-7',
    title: 'Lower Price Guarantee',
    desc: "We've put a variety of strategies to ensure the shipping cost is lowest for each service.",
  },
  {
    icon: 'icon-whyus-2',
    title: 'Frequency of Shipment',
    desc: 'We regularly ship; at list six times a week irrespective of size.',
  },
  {
    icon: 'icon-whyus-8',
    title: 'Gzavnilli Vehicles',
    desc: 'We use our vehicles for pickups and airport deliveries, so we’re always on time.',
  },
  {
    icon: 'icon-whyus-5',
    title: 'Pricing Options',
    desc: 'Our different pricing options allows you select your preferred service and speed of delivery.',
  },
  {
    icon: 'icon-whyus-3',
    title: 'Gzavnili Licenses',
    desc: 'With our license, we ship directly with airlines and give you the opportunity to have a fair price.',
  },
  {
    icon: 'icon-whyus-4',
    title: 'Tax-Free Shopping State',
    desc: 'Our Tax-Free Zone guarantees you shopping without sales tax for any product.',
  },
  {
    icon: 'icon-whyus-6',
    title: 'We Are Open Every Day',
    desc: 'Ship or drop at your convenient time. We operate 7 days a week to ensure reliability',
  },
];

export function WhyChooseUs() {
  return (
    <section className={s.whychooseus}>
      <div className="container">
        <h2>
          8 MAIN REASONS WHY OUR
          <br />
          CUSTOMERS LOVE GZAVNILLI
          <br /> SHIPING SERVICE?
        </h2>
        <div className="redline"></div>
        <a id="volumecalculatoranchor" className="anchor"></a>
        <div className="row">
          <div className={cn('col', 'col-8', s.col8)}>
            {WHY_US_ITEMS.map((item) => (
              <div className={s.whyusItem} key={item.title}>
                <i className={`icon ${item.icon}`}></i>
                <div className={s.whyusInfo}>
                  <div className={s.txt}>{item.title}</div>
                  <div className={s.desc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn('col', 'col-4', s.calcBlock)}>
            <div className={s.heading}>
              <h3>Calculator</h3>{' '}
              <a href="">
                <i className="icon icon-info"></i>
              </a>
            </div>
            <p>Calculate price/arrival day</p>

            <Calculator />
          </div>
        </div>
      </div>
    </section>
  );
}
