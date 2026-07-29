import Image from 'next/image';
import cn from 'classnames';
import s from './TrustUs.module.css';

export function TrustUs() {
  return (
    <section className={s.trustus}>
      <div className="container">
        <div className={s.trustusL}>
          <Image src="/img/trustus.jpg" alt="" width={284} height={550} />
        </div>

        <div className={s.trustusR}>
          <h2>A Faster, Cheaper and Safer Shipping!</h2>
          <div className="redline"></div>

          <p>
            Are you looking for a faster, cheaper and safer way to ship your goods? Gzavnilli invites you to enjoy the
            fastest and safest shipping services to Georgia
          </p>
          <p>
            With over 12 years of excellent service delivery, Gzavnilli boasts of over 40,000 active customers served
            from our 7 offices from around the globe and did more than 250,000 Kgs of parcels sent on last year alone.
          </p>
          <p>
            If you are looking for the best services at the best shipping rates to Georgia, get in touch with Gzavnilli,
            your trusted partner for shipping your goods from the USA to Georgia.
          </p>
          <p>
            We guarantee the safety of your goods, speedy delivery, affordable prices and a variety of options to choose
            from depending on which service suits you most. Besides, we use our vehicles and license which means your
            goods are always in safe hands at all time.
          </p>

          <div className={s.advantages}>
            <div className={cn(s.advItem, s.item1)}>
              <span>12 Years</span> of Rich Experience
            </div>
            <div className={cn(s.advItem, s.item2)}>
              <span>1.500.000 </span> Packages Already Delivered
            </div>
            <div className={cn(s.advItem, s.item3)}>
              <span>40,000</span> Active Customers
            </div>
          </div>

          <p>
            If you are looking to shop online too, we have an incredible variety of online stores from which you can buy
            and ship to tax-free state, Delaware. Our listed online stores offer fantastic discounts, deals, and
            coupons. Just choose a store, buy an item(s), use any of our office addresses and declare the parcel in your
            account using the tracking number of your order. The rest is on us!
          </p>
        </div>
      </div>
    </section>
  );
}
