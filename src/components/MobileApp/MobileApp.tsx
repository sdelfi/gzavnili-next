import { getTranslations } from 'next-intl/server';
import s from './MobileApp.module.css';

export async function MobileApp() {
  const t = await getTranslations('MobileApp');

  return (
    <section className={s.mobileApp}>
      <div className="container">
        <div className={s.txt}>
          <h3>{t('heading')}</h3>
          <p>{t('text')}</p>
          <div className={s.appBtns}>
            <a href="https://apps.apple.com/gb/app/gzavnili-customer/id1371450204" className={s.appstoreBtn}></a>
            <a
              href="https://play.google.com/store/apps/details?id=com.team.noty.gzavnili&hl=en"
              className={s.googleplayBtn}
            ></a>
          </div>
        </div>
      </div>
    </section>
  );
}
