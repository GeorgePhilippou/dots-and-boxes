# Dots & Boxes

A Pencil-friendly Dots and Boxes game for iPad, hosted on GitHub Pages with secured Firebase rooms for online play.

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
- Six board sizes, from 3 × 3 to 9 × 9 boxes
- Complete Dots and Boxes scoring and extra-turn rules
- Responsive portrait and landscape iPad layouts
- Local saved game and offline app shell
- Home Screen web-app metadata
- Install icons and offline caching for iPad Home Screen use
- Local two-player mode
- Single-player mode with a computer opponent
- Two-iPad rooms with six-character join codes

Online rooms use Firebase Anonymous Authentication and Realtime Database Security Rules. Players do not need accounts; each device receives a temporary anonymous identity, and only the room's two participants can update an active game.

## Online room setup

Choose **Two iPads**. One player selects **Create a room** and shares the displayed six-character code. The second player selects **Join a room**, enters that code, and starts playing. A room link containing `?room=CODE` opens directly in join mode.

## Add to an iPad Home Screen

After the site is published, open its GitHub Pages URL in Safari. Tap **Share**, choose **Add to Home Screen**, then tap **Add**. The installed app opens without Safari's normal browser controls and keeps its app shell available offline.
