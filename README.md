# Visual Preference Study

Anonymous mobile survey for ranking 25 photographs. Deployed as a static site on GitHub Pages, with Google Sheets as the backend via Apps Script.

## Flow

1. Review all 25 photos (randomized order)
2. Tap exactly six into a shortlist tray
3. Rank those six by tapping favorite first through #6
4. Pick the one absolute must-not
5. Two calibration questions (appearance, personality)
6. See only how close the response landed against the current pool

Admin dashboard lives at `admin.html`.

## Scoring

For each photo:

- **SelectionRate** = share of respondents who put it in their top 6
- **RankScore** = mean evaluation across all respondents, scaled 0–1  
  (selected ranks map to 6…1, unselected = 0, then divide by 6)
- **FinalScore** = `0.7 * SelectionRate + 0.3 * RankScore`
- **#1 rate** and **polarization** (SD of evaluations) are tracked separately

## Secret familiarity score

Two diagnostic asides are asked after ranking. Option order is shuffled. Correctness is never shown to respondents.

| Signal | High familiarity | Low familiarity |
| --- | --- | --- |
| Food order | Bagel toasted with avocados and tomatoes (+2) | Creamy mushroom soup (+0) |
| Phrase | “Exiting the premises” or “get the fuck out of here” (+2 each) | “About ready to be on my way” (+0) |

Middle options score +1. Total is 0–4:

- `0–1` stranger
- `2` mixed
- `3–4` knows

Admin compares top six and selection deltas across those groups.

## Setup

### 1. Google Sheet + Apps Script

1. Create a blank Google Sheet
2. **Extensions → Apps Script**
3. Paste everything from [`apps-script/Code.gs`](apps-script/Code.gs)
4. Change `ADMIN_KEY` near the top to a private value
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the web app URL

### 2. Front-end config

Edit [`js/config.js`](js/config.js):

```js
window.APP_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/XXXX/exec",
  ADMIN_KEY: "same-key-as-in-Code.gs",
  STUDY_NAME: "Visual Preference Study",
  SELECT_COUNT: 6,
};
```

### 3. GitHub Pages (no Actions)

1. Push this repo to GitHub
2. **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch**
4. Branch: `main` / root (or `docs` if you prefer)
5. Survey URL: `https://<user>.github.io/<repo>/`
6. Admin URL: `https://<user>.github.io/<repo>/admin.html`

## Local preview

```bash
cd dp_survey
python3 -m http.server 8080
```

Open `http://localhost:8080`. Submissions stay local until `SCRIPT_URL` is set.

## Notes

- Images load from Cloudflare R2 (`…/opt/DP_N.jpg`), mobile-optimized (~2MB total). Local `/images` copies are optional fallbacks only.
- Responses are anonymous. No login.
- Rotate any keys that were shared in chat before public launch.
- Re-deploy the Apps Script after changing `ADMIN_KEY`.
