// All UI text lives here. To translate, replace the values in this file
// (keep the keys). Current language: Turkish.

export const lang = "tr";

export const strings = {
  appName: "MuhteşemPiksel",
  appNameParts: ["Muhteşem", "Piksel"],
  tagline: "Her görselin içinde o yüz zaten var. Pikselleri yerine taşımak yeter.",
  description: "Herhangi bir görselin kendi piksellerini sabit bir hedef görsele dönüştürür.",

  sourceLabel: "Kaynak",
  targetLabel: "Hedef",
  resultLabel: "Sonuç",

  targetLoading: "Hedef görsel yükleniyor…",
  targetMissing:
    "Hedef görsel bulunamadı. Proje klasörüne sehzademustafa.png, sehzademustafa.jpeg veya sehzademustafa.jpg koyup sayfayı yenileyin.",
  targetLoadFailed: "Hedef görsel yüklenemedi. Dosyanın bozuk olmadığından emin olup sayfayı yenileyin.",

  dropTitle: "Bir görseli buraya bırakın",
  dropHint: "ya da dosya seçmek için tıklayın, veya Ctrl/Cmd+V ile yapıştırın",
  dropActive: "Bırakın, yüklensin",
  imageLoadFailed: "Bu dosya görsel olarak okunamadı. PNG, JPEG veya WebP deneyin.",

  computing: "Pikseller yerleştiriliyor…",
  computeDone: "Hazır",

  playback: "Oynatma",
  look: "Görünüm",
  image: "Görsel",

  play: "Oynat",
  pause: "Duraklat",
  replay: "Baştan",
  reverse: "Geri oynat",
  forward: "İleri oynat",
  speed: "Hız",
  dust: "Toz",
  trails: "İz bırak",
  smoothing: "Yumuşatma",
  resolution: "Çözünürlük",
  newSeed: "Yeni tohum",
  seed: "Tohum",
  loadImage: "Görsel yükle",
  showResult: "Sonucu göster",
  record: "Kaydet",
  recording: "Kaydediliyor…",
  recordUnsupported: "Bu tarayıcı kayıt özelliğini desteklemiyor.",

  shortcuts: [
    { key: "Boşluk", action: "oynat / duraklat" },
    { key: "R", action: "baştan" },
    { key: "H", action: "kontrolleri gizle" },
  ],
  cleanModeHint: "Kontrolleri göstermek için H tuşuna basın",
} as const;

export type Strings = typeof strings;
