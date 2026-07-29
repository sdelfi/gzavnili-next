import Image from "next/image";
import { FaqAccordion } from "@/components/FaqAccordion";
import { HomeHero } from "@/components/HomeHero";
import { Calculator } from "@/components/Calculator";
import { OfferParallax } from "@/components/OfferParallax";
import { VideoTutorials } from "@/components/VideoTutorials";
import { routes } from "@/lib/routes";

// Rebuilt from the real cached homepage content (see PROGRESS.md):
// ../http/include/pages/14FE4559026D4C5B5EB530EE70300C52D99E70D7.json, `content` field —
// the actual server-rendered output for `/index.html`, cross-checked against
// https://usa.gzavnili.com/. The previous version of this file was ported from
// `views/home.html`, which turned out to be dead code (never included by the live layout).
const WHY_US_ITEMS = [
  {
    icon: "icon-whyus-1",
    title: "Delivery Speed",
    desc: "If you prioritize speed, you’ll definitely love our services – we are the fastest.",
  },
  {
    icon: "icon-whyus-7",
    title: "Lower Price Guarantee",
    desc: "We've put a variety of strategies to ensure the shipping cost is lowest for each service.",
  },
  {
    icon: "icon-whyus-2",
    title: "Frequency of Shipment",
    desc: "We regularly ship; at list six times a week irrespective of size.",
  },
  {
    icon: "icon-whyus-8",
    title: "Gzavnilli Vehicles",
    desc: "We use our vehicles for pickups and airport deliveries, so we’re always on time.",
  },
  {
    icon: "icon-whyus-5",
    title: "Pricing Options",
    desc: "Our different pricing options allows you select your preferred service and speed of delivery.",
  },
  {
    icon: "icon-whyus-3",
    title: "Gzavnili Licenses",
    desc: "With our license, we ship directly with airlines and give you the opportunity to have a fair price.",
  },
  {
    icon: "icon-whyus-4",
    title: "Tax-Free Shopping State",
    desc: "Our Tax-Free Zone guarantees you shopping without sales tax for any product.",
  },
  {
    icon: "icon-whyus-6",
    title: "We Are Open Every Day",
    desc: "Ship or drop at your convenient time. We operate 7 days a week to ensure reliability",
  },
];

const FAQ_ITEMS = [
  {
    question: "Gzavnilli Shipping Days",
    answer:
      "Both Regular and Express services send parcels three times a week. Express service departure days are Monday, Wednesday, and Saturday while Regular parcels happen on Tuesday, Friday and Sunday.",
  },
  {
    question: "How long is transit time?",
    answer:
      "Transit time for Express service From New York to Tbilisi is 3 calendar days (from day of departure), for regular shipment average time is 5-7 days.",
  },
  {
    question: "How can I find office working schedule?",
    answer:
      "We are open throughout the year, except on Easter, Christmas and New Year. Check our contact us page for more details on this.",
  },
  {
    question: "Does Gzavnilli Offer the Cheapest and Fastest Shipping Service?",
    answer:
      "Absolutely! We offer the cheapest, safest and fastest parcel services from the USA to Georgia. Our shipping services are unique, and no other company can match our standards and efficiency.",
  },
  {
    question: "Which Payment Methods Does Gzavnilli Accept?",
    answer:
      "We accept almost all type of payments: PayPal, Debit or credit card payment, checks, money orders, cash, bill pay (from your online banking), wire transfer and bank deposit.",
  },
];

const NEWS_ITEMS = [
  {
    image: "https://www.gzavnili.com/include/pages/files/ge/ganrigi.jpg",
    title: "More care on faster transit!",
    date: "November 14th, 2016",
    teaser:
      "Very excited to inform you, that for Express service we started using Block Space service. That means we are buying space every time on all flights from USA to Georgia, which virtually eliminates the delay if the flight is not canceled.",
  },
  {
    image: "https://www.gzavnili.com/include/pages/files/ge/6%20times.jpg",
    title: "We do most frequent shipping!",
    date: "September 5th, 2016",
    teaser:
      "We are pleased to announce to the friends and supporters of Gzavnili LLC the release of the most frequent parcel service from USA to Georgia. There are 3 airlines involved in this service, with six connection fights. This service is available for all faithful customers with promise of best present-day service.",
  },
  {
    image: "https://www.gzavnili.com/include/pages/files/ge/choose%20a%20speed.jpg",
    title: "You select the price and speed!",
    date: "August 19th, 2016",
    teaser:
      "Another pleasant news for precious customers of the Gzavnili - now can choose how fast do you want to get a parcel from the United States 2 Georgia. At the same time, Gzavnili is guarantee that each type of service always will offer have the lowest price.",
  },
];

export default function Home() {
  return (
    <>
      <HomeHero />

      <section className="trustus">
        <div className="container">
          <div className="trustus-l">
            <Image src="/img/trustus.jpg" alt="" width={284} height={550} />
          </div>

          <div className="trustus-r">
            <h2>A Faster, Cheaper and Safer Shipping!</h2>
            <div className="redline"></div>

            <p>
              Are you looking for a faster, cheaper and safer way to ship your goods? Gzavnilli
              invites you to enjoy the fastest and safest shipping services to Georgia
            </p>
            <p>
              With over 12 years of excellent service delivery, Gzavnilli boasts of over 40,000
              active customers served from our 7 offices from around the globe and did more
              than 250,000 Kgs of parcels sent on last year alone.
            </p>
            <p>
              If you are looking for the best services at the best shipping rates to Georgia,
              get in touch with Gzavnilli, your trusted partner for shipping your goods from the
              USA to Georgia.
            </p>
            <p>
              We guarantee the safety of your goods, speedy delivery, affordable prices and a
              variety of options to choose from depending on which service suits you most.
              Besides, we use our vehicles and license which means your goods are always in safe
              hands at all time.
            </p>

            <div className="advantages">
              <div className="adv-item item-1">
                <span>12 Years</span> of Rich Experience
              </div>
              <div className="adv-item item-2">
                <span>1.500.000 </span> Packages Already Delivered
              </div>
              <div className="adv-item item-3">
                <span>40,000</span> Active Customers
              </div>
            </div>

            <p>
              If you are looking to shop online too, we have an incredible variety of online
              stores from which you can buy and ship to tax-free state, Delaware. Our listed
              online stores offer fantastic discounts, deals, and coupons. Just choose a store,
              buy an item(s), use any of our office addresses and declare the parcel in your
              account using the tracking number of your order. The rest is on us!
            </p>
          </div>
        </div>
      </section>

      <OfferParallax>
        <div className="container">
          <div className="txt">
            <h2>Special offer!</h2>
            <p>
              Enjoy great Deals, Discounts and Coupons when you shop from our partner online
              stores. You may just get your shipping costs covered by coupons and discounts
              received while shopping at our partner stores.
            </p>
            <div className="redline"></div>

            <div className="btn-block">
              <a href="" className="btn btn-red">
                Get Started Now! <i className="icon icon-arr1"></i>
              </a>
            </div>
          </div>
        </div>
      </OfferParallax>

      <section className="whychooseus">
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
            <div className="col col-8">
              {WHY_US_ITEMS.map((item) => (
                <div className="whyus-item" key={item.title}>
                  <div className="whyus-item-inner">
                    <i className={`icon ${item.icon}`}></i>
                    <div className="whyus-info">
                      <div className="txt">{item.title}</div>
                      <div className="desc">{item.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="col col-4 calc-block">
              <div className="calc-block-inner">
                <div className="heading">
                  <h3>Calculator</h3>{" "}
                  <a href="">
                    <i className="icon icon-info"></i>
                  </a>
                </div>
                <p>Calculate price/arrival day</p>

                <Calculator />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="row faq-quesions-block">
          <section className="col col-6 faq">
            <h3>Frequently Asked Questions</h3>

            <FaqAccordion items={FAQ_ITEMS} />

            <div className="ralign">
              <p>
                <a href={routes.page("faq")}>See all answers</a>
              </p>
            </div>
          </section>

          <VideoTutorials />
        </div>
      </div>

      <section className="mobile-app">
        <div className="container">
          <div className="txt">
            <h3>Mobile app</h3>
            <p>Download - Free tool, for good news! </p>
            <div className="app-btns">
              <a
                href="https://apps.apple.com/gb/app/gzavnili-customer/id1371450204"
                className="appstore-btn"
              ></a>
              <a
                href="https://play.google.com/store/apps/details?id=com.team.noty.gzavnili&hl=en"
                className="googleplay-btn"
              ></a>
            </div>
          </div>
        </div>
      </section>

      <section className="news">
        <div className="container">
          <h2>Latest Company News</h2>
          <div className="redline"></div>
          <div className="news-list">
            {NEWS_ITEMS.map((item) => (
              <div className="item" key={item.title}>
                <a href="" className="img">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external, legacy-domain
                      hotlinked placeholder (unmigrated news content, see PROGRESS.md); unknown/
                      varying dimensions, not worth an external-domain next/image config for
                      content that's going away once real news items are migrated. */}
                  <img src={item.image} alt="" />
                </a>
                <a href="" className="title">
                  {item.title}
                </a>
                <div className="date">{item.date}</div>
                <div className="teaser">{item.teaser}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
