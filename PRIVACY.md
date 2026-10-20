# Privacy

Your use of this app is covered by the [Unity Developer Privacy Policy](https://unity.com/legal/developer-privacy-policy).
One optional feature sends data to a third party:

**Profile pictures (Gravatar, by Automattic, USA).** If you turn this on, the app sends Gravatar a one-way hash of the
email address of each person shown whose username is an email address, along with your IP address, to fetch their
profile picture. It's off until you turn it on, and you can change it any time in Settings › Appearance.

## What else leaves your device

This desktop client has no backend. All version-control operations run on your device against your own UVCS server.
If your server is Unity-hosted, this app doesn't change where your data lives. Repository data is loaded into memory
for your current session only and is never uploaded. There is no telemetry, analytics or crash reporting.

Besides your UVCS server, the app makes two connections that aren't optional:

- **Update checks (GitHub, by Microsoft, USA).** The app checks GitHub for new releases, sending your IP address.
- **Spell-checking dictionaries (Google, USA).** On Windows and Linux, the app downloads a spell-checking dictionary
  for your system's language from Google's servers, sending your IP address and the dictionary's language.
  On macOS, the system's own spellchecker is used and nothing is downloaded.
