import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';

// The "Have a question?" side column — identical content on the legacy login and
// forgot-password pages (`authenticate/login.html`/`authenticate/forgotlogin.html`), so
// shared here rather than duplicated. Renders as plain `h3`/`h4`/`ul`/`li`/`a` tags with no
// classNames of its own — styled by the ambient `.inner` wrapper `AuthLayout` renders around
// whatever it's passed as `aside` (see AuthLayout.module.css's `.inner h3`/`h4`/`ul` rules).
export async function QuestionPanel() {
  const t = await getTranslations('Authenticate');
  return (
    <>
      <h3>{t('haveQuestion')}</h3>
      <h4>{t('videoHelper')}</h4>
      <ul>
        <li>
          <a href="#">{t('howToRegister')}</a>
        </li>
        <li>
          <a href="#">{t('howToRestorePassword')}</a>
        </li>
        <li>
          <a href="#">{t('howToRestoreUserId')}</a>
        </li>
      </ul>

      <h4>{t('testAccountQuestion')}</h4>
      <ul>
        <li>
          <a href={routes.testAccountLogin()}>{t('logInToTestAccount')}</a>
        </li>
      </ul>
    </>
  );
}
