# Dots & Boxes

A Pencil-friendly Dots and Boxes prototype for two players. This first version is a local pass-and-play game and is ready for static hosting on GitHub Pages.

## Run locally

From this folder:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765`.

## Publish with GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.

## Prototype scope

- Pencil, finger, and mouse input using Pointer Events
- Three board sizes
- Complete Dots and Boxes scoring and extra-turn rules
- Responsive portrait and landscape iPad layouts
- Local saved game and offline app shell
- Home Screen web-app metadata
- Install icons and offline caching for iPad Home Screen use

The next milestone is remote two-iPad rooms using Firebase Realtime Database and anonymous authentication.

## Add to an iPad Home Screen

After the site is published, open its GitHub Pages URL in Safari. Tap **Share**, choose **Add to Home Screen**, then tap **Add**. The installed app opens without Safari's normal browser controls and keeps its app shell available offline.
