# Canon Only

Type an anime and get only its canon episodes. Filler is cut out.

The episode types and posters come from the community-run [Anime Filler List](https://www.animefillerlist.com).

## What's in this folder

| File | What it is |
| --- | --- |
| `page.html` | The page itself. The Claude artifact version publishes this file. |
| `index.html` | The installable phone app. Built from `page.html` by `scripts/build.py`. |
| `app.js` | All the app logic (search, filtering, watched checkmarks, refresh button). |
| `data.json` | Every show's episodes, each tagged manga canon, anime canon, mixed, or filler. |
| `posters/` | One small poster per show. |
| `manifest.webmanifest`, `sw.js`, `icons/` | What makes it installable and work offline. |
| `scripts/scrape.py` | Pulls the latest lists from animefillerlist.com into `data.json`. |
| `scripts/posters.py` | Downloads and shrinks posters for any new shows. |
| `.github/workflows/refresh.yml` | Runs both scripts every Monday and commits the changes. |

## Put it on your phone (free, about 5 minutes)

1. Create a new **public** repository on GitHub and upload everything in this folder, including the `.github` folder.
2. In the repo, go to **Settings → Pages**. Under "Build and deployment", pick **Deploy from a branch**, then `main` and `/ (root)`. Save.
3. After a minute, GitHub shows your app's address, like `https://<your-username>.github.io/<repo-name>/`.
4. Open that address on your phone:
   - **iPhone (Safari):** tap Share, then **Add to Home Screen**.
   - **Android (Chrome):** tap the menu, then **Install app** (or **Add to Home screen**).

It now opens full screen from its own icon and works offline once you've opened it.

## Keeping the lists fresh

- **Automatic:** the GitHub Action re-pulls every list every Monday. In your repo, go to **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions** so it can save the new data.
- **On demand:** open the **Actions** tab, pick **Refresh episode lists**, and press **Run workflow**.
- **In the app:** the **Check for new episodes** button at the bottom loads the newest `data.json`.

## Run it on your computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Rebuild after editing

If you change `page.html`, rebuild the app page:

```bash
python3 scripts/build.py
```

## Want it in the App Store / Play Store?

The app can be wrapped with [Capacitor](https://capacitorjs.com) (`npx cap init`, then `npx cap add ios` / `npx cap add android`). Publishing needs an Apple developer account ($99/year) and/or a Google Play account ($25 one-time). The home-screen install above is free and works the same for personal use.
