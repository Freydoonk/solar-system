# Interface fonts

Bundled locally through Fontsource Variable, with no runtime font service requests:

- [Inter](https://github.com/rsms/inter), used for English, Spanish and French. [OFL licence](inter-OFL.txt).
- [Vazirmatn](https://github.com/rastikerdar/vazirmatn), used for Persian. [OFL licence](vazirmatn-OFL.txt).
- [Noto Sans Arabic](https://github.com/notofonts/arabic), used for Arabic. [OFL licence](noto-sans-arabic-OFL.txt).

`src/fonts.css` selects the Latin/Latin Extended Inter subsets and Arabic-script subsets of Vazirmatn and Noto Sans Arabic. Vite copies their WOFF2 files into the production assets; the service worker includes them for offline use. Original font copyright notices are included in the licence files.
