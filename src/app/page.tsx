import { FaqAccordion } from "@/components/FaqAccordion";
import { HomeSlider } from "@/components/HomeSlider";

// Ported from the legacy http/views/home.html (English homepage content).
// Same markup/classes/images so css/style.css + css/style_custom.css apply unchanged.
// Copy is the original placeholder copy from the legacy file (incl. the Lorem ipsum
// FAQ/news blocks) — content owners can replace it later without touching structure.
// The slider and FAQ accordion (previously lightSlider/click handlers in main.js)
// are separate client components; everything else here stays a plain server-rendered
// (and statically generated) page.
const FAQ_ITEMS = Array.from({ length: 4 }, () => ({
  question: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit.",
  answer:
    "Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus. Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum.",
}));

export default function Home() {
  return (
    <>
      <HomeSlider />

      <section className="trustus">
        <div className="container">
          <div className="trustus-l">
            <img src="/img/trustus.jpg" alt="" />
          </div>

          <div className="trustus-r">
            <h2>Trust Us To Deliver Your Goods!</h2>
            <div className="redline"></div>

            <p>
              With 7 years of experience delivering excellence, over 11,000 active customers
              and more than 7 offices around the globe, Gzavnilli is your trusted partner for
              shipping your goods to Georgia and within the USA.
            </p>

            <p>
              We guarantee the safety of your goods, speedy delivery, affordable prices and a
              variety of options to choose from depending on which service suits you most. In
              addition, we use our own vehicles and license which means your goods are always
              in safe hands at all time.
            </p>

            <div className="advantages">
              <div className="adv-item item-1">
                <span>7</span> years of <br />
                experience
              </div>
              <div className="adv-item item-2">
                <span>7</span> offices around <br />
                the world
              </div>
              <div className="adv-item item-3">
                <span>11 000+</span> active <br />
                customers
              </div>
            </div>

            <p>
              More than just shipping, we also offer you a variety of trusted online shopping
              stores from which you can shop to tax-free state - Delaware. Moreover, these
              shopping stores offer a huge pack of discounts, deals, coupons and cashbacks,
              some of which may even cover your shipping costs. Simply shop from them, use any
              of our office addresses and declare the parcel in your account using the
              tracking number of your order. The rest is on us!
            </p>
          </div>
        </div>
      </section>

      <section className="specialoffer">
        <div className="container">
          <div className="txt">
            <h2>Special offer!</h2>
            <p>
              Enjoy great Deals, Discounts and Cashbacks when you shop from our partner
              online stores. You may just get your shipping costs covered by coupons,
              discounts and commissions received while shopping with our partner stores.
            </p>
            <div className="redline"></div>

            <div className="btn-block">
              <a href="#" className="btn btn-red">
                Get Started Now! <i className="icon icon-arr1"></i>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="whychooseus">
        <div className="container">
          <h2>Why choose us?</h2>
          <div className="redline"></div>
          <div className="row">
            <div className="col col-8">
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-1"></i>
                  <div className="whyus-info">
                    <div className="txt">The speed of delivery</div>
                    <div className="desc">
                      If you prioritize speed, you&rsquo;ll definitely love our services –
                      we are the fastest.
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-7"></i>
                  <div className="whyus-info">
                    <div className="txt">Lower price guarantee</div>
                    <div className="desc">
                      We&apos;ve put a variety of strategies to ensure the shipping cost is
                      lowest for each service.
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-2"></i>
                  <div className="whyus-info">
                    <div className="txt">The frequency of shipments</div>
                    <div className="desc">
                      We regularly ship, up to five times a week irrespective of size.
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-8"></i>
                  <div className="whyus-info">
                    <div className="txt">Own vehicles</div>
                    <div className="desc">
                      We use our own vehicles for pickups and doorstep deliveries to ensure
                      you always pay less
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-3"></i>
                  <div className="whyus-info">
                    <div className="txt">Your choice of price</div>
                    <div className="desc">
                      We are offer to you option to choose rice of service and speed of
                      transit
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-5"></i>
                  <div className="whyus-info">
                    <div className="txt">Own License</div>
                    <div className="desc">
                      With our license, we ship directly with airlines and give you the
                      opportunity to have a fair price.
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-4"></i>
                  <div className="whyus-info">
                    <div className="txt">Partner Shopping Portal with a Tax-Free Zone</div>
                    <div className="desc">
                      Our Tax-Free Zone guarantee that you&apos;ll enjoy easy, fun and
                      affordable shopping and shipping.
                    </div>
                  </div>
                </div>
              </div>
              <div className="whyus-item">
                <div className="whyus-item-inner">
                  <i className="icon icon-whyus-6"></i>
                  <div className="whyus-info">
                    <div className="txt">We are open seven days per week</div>
                    <div className="desc">
                      Ship or drop at your convenient time. We operate 7 days a week to
                      ensure reliability.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col col-4 calc-block">
              <div className="calc-block-inner">
                <div className="heading">
                  <h3>Calculator</h3>{" "}
                  <a href="#">
                    <i className="icon icon-info"></i>
                  </a>
                </div>
                <p>Calculate price/arrival day</p>

                <form action="#">
                  <div className="row">
                    <div className="input-group col col-9">
                      <label htmlFor="calc-weight">Weight*</label>
                      <input type="text" id="calc-weight" />
                    </div>
                    <div className="input-group col col-3 nolabel">
                      <select>
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                  </div>
                  <div className="row">
                    <div className="input-group col col-3">
                      <label htmlFor="calc-length">Length*</label>
                      <input type="text" id="calc-length" />
                    </div>
                    <div className="input-group col col-3">
                      <label htmlFor="calc-height">Height</label>
                      <input type="text" id="calc-height" />
                    </div>
                    <div className="input-group col col-3">
                      <label htmlFor="calc-width">Width</label>
                      <input type="text" id="calc-width" />
                    </div>
                    <div className="input-group col col-3 nolabel">
                      <select>
                        <option value="in">in</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Choose service</label>
                    <select>
                      <option>Regular Shipping</option>
                      <option>Accelerated Shipping</option>
                      <option>Decelerated Shipping</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Receiving Day</label>
                    <select>
                      <option>Sunday</option>
                      <option>Monday</option>
                      <option>Doesn&apos;t Matter</option>
                    </select>
                  </div>
                  <div className="btn-block">
                    <a href="#" className="btn btn-blue">
                      Calculate <i className="icon icon-arr2"></i>
                    </a>
                  </div>
                </form>
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
                For more questions follow link <a href="/faq.html">Cargo Service</a>
              </p>
            </div>
          </section>
          <section className="col col-6 contact-form">
            <h3>Have Any More Questions?</h3>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean euismod
              bibendum laoreet. Proin gravida dolor sit amet lacus accumsan et viverra justo
              commodo.
            </p>

            <form action="#">
              <div className="row">
                <div className="input-group col col-6 col-xs-12">
                  <label htmlFor="contact-name">Your name</label>
                  <input type="text" id="contact-name" />
                </div>
                <div className="input-group col col-6 col-xs-12">
                  <label htmlFor="contact-email">Your e-mail</label>
                  <input type="text" id="contact-email" />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="contact-subject">Subject matter</label>
                <select id="contact-subject">
                  <option>Online Shopping</option>
                  <option>Offline Shopping</option>
                  <option>Shipping</option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="contact-message">Text message</label>
                <textarea id="contact-message" rows={3}></textarea>
              </div>
              <div className="btn-block ralign">
                <a className="btn btn-blue">
                  Send <i className="icon icon-arr1"></i>
                </a>
              </div>
            </form>
          </section>
        </div>
      </div>

      <section className="mobile-app">
        <div className="container">
          <div className="txt">
            <h3>Mobile app</h3>
            <p>Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum.</p>
            <div className="app-btns">
              <a href="#" className="appstore-btn"></a>
              <a href="#" className="googleplay-btn"></a>
            </div>
          </div>
        </div>
      </section>

      <section className="news">
        <div className="container">
          <h2>Latest News</h2>
          <div className="redline"></div>
          <div className="news-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="item" key={i}>
                <a href="#" className="img">
                  <img src="/img/tmp/news-380.jpg" alt="" />
                </a>
                <a href="#" className="title">
                  Nam quam nunc, blandit vel, luctus pulvinar, hendrerit id, lorem.
                </a>
                <div className="date">November 5, 2015</div>
                <div className="teaser">
                  Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum. Aenean
                  imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies
                  nisi. Nam eget dui. Etiam rhoncus. Maecenas tempus, tellus eget condimentum
                  rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum.
                </div>
                <div className="ralign">
                  <a href="#" className="more">
                    Read more
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
