import './globals.css';

export const metadata = {
  title: 'DairyFlow — интеллектуальное управление производством',
  description: 'Учебный прототип интеллектуальной системы управления ресурсами молочного цеха'
};

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}</body></html>;
}
