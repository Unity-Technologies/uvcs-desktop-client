# What this app sends, and to whom

This desktop client has no backend. All version-control operations run on your device against your own UVCS server.
If your server is Unity-hosted, this app doesn't change where your data lives. Repository data is loaded into memory
for your current session only and is never uploaded.

Three things leave your device, to third parties (not Unity):

- **Profile pictures (Gravatar - Automattic, USA).** When avatars are enabled, the app sends a one-way SHA-256 hash of
  the email address of each person shown in the client whose username is an email address, along with the standard
  IP address and user-agent of a web request, to fetch a profile picture. It's off until you turn it on: the app asks
  once, the first time it shows people, and you can change it any time in Settings › Appearance.
- **Update checks (GitHub - Microsoft, USA).** The app checks GitHub for new releases, sending the standard IP address
  and user-agent of a web request.
- **Spell-checking dictionaries (Google, USA).** On Windows and Linux, the app downloads a spell-checking dictionary
  for your system's language from Google's servers, sending the standard IP address and user-agent of a web request
  and the dictionary's language. On macOS, the system's own spellchecker is used and nothing is downloaded.
