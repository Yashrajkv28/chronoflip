# Firebase Reminders

## Realtime Database Test Mode Expiry

**Created:** 2026-03-03
**Expires:** ~2026-04-02 (30 days from creation)

Firebase Realtime Database was set up in **test mode**, which allows public read/write access for 30 days. After expiry, all reads and writes will be denied.

### How to fix when it expires:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project **speechtimer-ceb4b**
3. Go to **Build > Realtime Database > Rules**
4. Either:
   - **Extend test mode** — set a new date:
     ```json
     {
       "rules": {
         ".read": "now < 1748908800000",
         ".write": "now < 1748908800000"
       }
     }
     ```
     (Change the timestamp to 30 days from now. Use https://www.epochconverter.com/)

   - **Or add proper auth rules** when login is implemented:
     ```json
     {
       "rules": {
         "shared": {
           "$shareId": {
             ".read": true,
             ".write": "auth != null"
           }
         }
       }
     }
     ```

### Signs that it expired:
- QR code sharing stops working
- Viewers see "Not Found" or loading spinner forever
- Browser console shows Firebase permission denied errors
