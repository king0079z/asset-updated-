import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>AssetTrack - Enterprise Asset Management</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/app-favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/app-favicon.ico" type="image/x-icon" />
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarCode.all.min.js"></script>
      </Head>
      <body>
        <Main />
        <Script src="https://assets.co.dev/files/codevscript.js" strategy="afterInteractive" />
        <NextScript />
      </body>
    </Html>
  );
}
