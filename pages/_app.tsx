import '../styles/globals.css';
import '../styles/github-dark.css';
import 'katex/dist/katex.min.css';
import '../styles/katex-custom.css';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp; 