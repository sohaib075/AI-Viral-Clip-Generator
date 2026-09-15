# AI Viral Clips mobile app

The Expo app for the AI Viral Clip Generator: submit links or video files, follow processing, restyle and export clips, publish them, and generate story videos.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

   If you pulled a version that added native modules (for example `expo-document-picker` and `expo-secure-store`), run `npx expo install --check` afterwards so the versions match your Expo SDK and `package-lock.json` is updated. Rebuild development clients after adding native modules.

2. Start the app

   ```bash
   npx expo start
   ```

## Backend URL

During development the app talks to the backend on the machine running `npx expo start` (port 5000).

Standalone builds (APK/AAB/IPA) need `EXPO_PUBLIC_API_URL` set to a URL the phone can reach:

- **Phone on the same Wi-Fi as your PC:** your PC's local IP, e.g. `http://192.168.1.100:5000`. The `preview` profile in `eas.json` sets this; update the IP to match your PC.
- **Deployed backend:** an `https://` URL. Add `"env": { "EXPO_PUBLIC_API_URL": "https://..." }` to the `production` profile in `eas.json`.

Plain `http://` URLs are allowed in release builds only when `EXPO_PUBLIC_API_URL` starts with `http://` (see `plugins/with-cleartext-http.js`). Production builds fail if `EXPO_PUBLIC_API_URL` isn't set, rather than shipping an app that can't reach the server.

## Access token and social accounts

- If the backend sets `API_TOKEN`, enter it once in **Settings → Access Token**. It is stored in the device's secure storage. You can also bake a token into a build with `EXPO_PUBLIC_API_TOKEN`.
- **Settings → Social Accounts** connects YouTube, TikTok, Instagram or X in an in-app browser and returns to the app when done. The backend's `BASE_URL` (used for OAuth redirects) must be reachable from the phone, e.g. your PC's LAN IP.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
