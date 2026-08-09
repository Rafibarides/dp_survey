/** Canonical photo set. Mobile-optimized JPEGs served from Cloudflare R2. */
const R2 = "https://pub-12ef38a931494afd92935aacaf61a4f8.r2.dev/opt";

window.PHOTOS = [
  { id: "DP_1", src: `${R2}/DP_1.jpg`, label: "01" },
  { id: "DP_2", src: `${R2}/DP_2.jpg`, label: "02" },
  { id: "DP_3", src: `${R2}/DP_3.jpg`, label: "03" },
  { id: "DP_4", src: `${R2}/DP_4.jpg`, label: "04" },
  { id: "DP_5", src: `${R2}/DP_5.jpg`, label: "05" },
  { id: "DP_6", src: `${R2}/DP_6.jpg`, label: "06" },
  { id: "DP_7", src: `${R2}/DP_7.jpg`, label: "07" },
  { id: "DP_8", src: `${R2}/DP_8.jpg`, label: "08" },
  { id: "DP_9", src: `${R2}/DP_9.jpg`, label: "09" },
  { id: "DP_10", src: `${R2}/DP_10.jpg`, label: "10" },
  { id: "DP_11", src: `${R2}/DP_11.jpg`, label: "11" },
  { id: "DP_12", src: `${R2}/DP_12.jpg`, label: "12" },
  { id: "DP_13", src: `${R2}/DP_13.jpg`, label: "13" },
  { id: "DP_14", src: `${R2}/DP_14.jpg`, label: "14" },
  { id: "DP_15", src: `${R2}/DP_15.jpg`, label: "15" },
  { id: "DP_16", src: `${R2}/DP_16.jpg`, label: "16" },
  { id: "DP_17", src: `${R2}/DP_17.jpg`, label: "17" },
  { id: "DP_18", src: `${R2}/DP_18.jpg`, label: "18" },
  { id: "DP_19", src: `${R2}/DP_19.jpg`, label: "19" },
  { id: "DP_20", src: `${R2}/DP_20.jpg`, label: "20" },
  { id: "DP_21", src: `${R2}/DP_21.jpg`, label: "21" },
  { id: "DP_22", src: `${R2}/DP_22.jpg`, label: "22" },
  { id: "DP_23", src: `${R2}/DP_23.jpg`, label: "23" },
  { id: "DP_24", src: `${R2}/DP_24.jpg`, label: "24" },
  { id: "DP_25", src: `${R2}/DP_25.jpg`, label: "25" },
];

window.PHOTO_BY_ID = Object.fromEntries(window.PHOTOS.map((p) => [p.id, p]));
